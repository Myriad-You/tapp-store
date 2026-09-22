/* Pure, bounded import/upgrade engine. No I/O, shell execution, or diagnostics containing values.
 * YAML: vendored js-yaml 4.1.1 (MIT), CORE_SCHEMA only; anchors/aliases are rejected.
 */
'use strict';
var yaml = require('./vendor/js-yaml.js');
var MAX_INPUT = 262144;
var SERVICES = ['postgres','backend-volume-init','backend','frontend','proxy','updater','updater-gateway','docker-guard','persona-worker','federation-worker'];
var CORE_NETS = ['myriad-net','myriad-admin-net','myriad-docker-guard-net'];
var NETWORK_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
var WORKERS = ['persona-worker','federation-worker'];
// Mirrors updater/src/docker/guard/validate.rs worker environment boundary.
var WORKER_ENV = ['MYRIAD_PROCESS_ROLE','DATABASE_URL','SERVER_HOST','SERVER_PORT','DATA_DIR','CACHE_DIR','JWT_SECRET','MYRIAD_DATA_KEY','CORS_ORIGINS','ENVIRONMENT','FRONTEND_URL','BASE_URL','RUST_LOG','TZ','PATH','MYRIAD_VERSION','MYRIAD_COMMIT_SHA','TRUST_PROXY_HEADERS','TRUST_PROXY_PEERS'];
var STATE_KEYS = {JWT_SECRET:'jwtSecret',UPDATE_TOKEN:'updateToken',UPDATER_GATEWAY_SECRET:'updaterGatewaySecret',MYRIAD_SETUP_SECRET:'setupSecret',ANALYTICS_SALT:'analyticsSalt',PERSONA_DB_PASSWORD:'personaDbPassword',FEDERATION_DB_PASSWORD:'federationDbPassword',GUARD_SELF_UPDATE_TOKEN:'guardSelfUpdateToken',HTTP_PORT:'httpPort',HTTP_BIND_ADDRESS:'httpBindAddress',MYRIAD_DOCKER_NETWORK:'netMyriad',MYRIAD_ADMIN_NETWORK:'netAdmin',MYRIAD_DOCKER_GUARD_NETWORK:'netGuard',MYRIAD_MEMORY_PROFILE:'memoryProfile'};
var TARGET_ENV = /^(?:MYRIAD_TAG|PROXY_TAG|UPDATER_TAG|BACKEND_IMAGE|FRONTEND_IMAGE|PROXY_IMAGE|UPDATER_IMAGE|UPDATER_IMAGE_REF|UPDATER_GATEWAY_IMAGE_REF|DOCKER_GUARD_IMAGE|MYRIAD_VERSION)$/;
var MANAGED_ENV = /^(?:MYRIAD_PROCESS_ROLE|SERVER_HOST|SERVER_PORT|DATA_DIR|CACHE_DIR|MYRIAD_VOLUME_INIT_ONLY|PERSONA_WEB_UPSTREAM|MYRIAD_UPDATER_URL|PROXY_(?:BACKEND|FRONTEND|PERSONA|FEDERATION|UPDATER)_UPSTREAM|BRANDING_METADATA_URL|UPDATER_UPSTREAM|GATEWAY_LISTEN|DOCKER_HOST|DOCKER_GUARD_(?:EXPECTED_IMAGE|HOST_POLICY_PATH|COMPOSE_DIR|STATE_DIR)|UPDATER_(?:GUARD_ENV_FILE|STATE_DIR|ENV_FILE|PGDATA|COMPOSE_DIR)|MYRIAD_VERSION)$/;
var SAFE_FIELDS = ['healthcheck','deploy','logging','restart','stop_grace_period','extra_hosts','dns','dns_search','labels','shm_size','ulimits'];
var KNOWN_FIELDS = SAFE_FIELDS.concat(['image','container_name','environment','volumes','networks','depends_on','healthcheck','ports','expose','command','entrypoint','user','security_opt','read_only','tmpfs','cap_drop','pids_limit','network_mode']);
function fail(path, message) { var error = new Error(path + ': ' + message); error.name = 'UpgradeError'; throw error; }
function own(obj,key) {return Object.prototype.hasOwnProperty.call(obj,key);}
function object(value) {return !!value && typeof value==='object' && !Array.isArray(value);}
function input(text,path) {if(typeof text!=='string'||text.length>MAX_INPUT||text.indexOf('\0')!==-1)fail(path,'invalid input or file exceeds 256 KiB');}
function clone(value){return JSON.parse(JSON.stringify(value));}
function mapTree(value,fn,depth,counter) {
  depth=depth||0;counter=counter||{n:0};
  if(depth>48||++counter.n>20000)fail('compose','document exceeds structural limits');
  if(typeof value==='string')return fn(value);
  if(Array.isArray(value))return value.map(function(v){return mapTree(v,fn,depth+1,counter);});
  if(object(value)){var out={};Object.keys(value).forEach(function(k){if(k==='__proto__'||k==='constructor'||k==='prototype')fail('compose','unsafe mapping key');out[k]=mapTree(value[k],fn,depth+1,counter);});return out;}
  return value;
}
function parseYaml(text) {
  input(text,'compose'); var value;
  try {value=yaml.load(text,{schema:yaml.CORE_SCHEMA,listener:function(event,state){if(state.anchor!==null&&state.anchor!==undefined)fail('compose','YAML anchors and aliases are not supported; expand them first');}});}
  catch(error){if(error.name==='UpgradeError')throw error;fail('compose','invalid YAML (check syntax, duplicate keys, tags, and aliases)');}
  if(!object(value)||!object(value.services))fail('compose.services','a service mapping is required');
  return mapTree(value,function(v){return v;});
}
function interpolate(text,env,path,depth) {
  depth=depth||0;if(depth>16)fail(path,'interpolation nesting exceeds limit');
  var out='';
  for(var i=0;i<text.length;){
    if(text[i]!=='$'){out+=text[i++];continue;}
    if(text[i+1]==='$'){out+='$';i+=2;continue;}
    var expression,match,end;
    if(text[i+1]==='{'){
      var level=1;end=i+2;
      while(end<text.length&&level){if(text[end]==='{')level++;if(text[end]==='}')level--;end++;}
      if(level)fail(path,'unclosed variable reference');
      expression=text.slice(i+2,end-1);match=expression.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:(:?[-+?])([\s\S]*))?$/);
      if(!match)fail(path,'unsupported variable expression');
    }else{
      match=text.slice(i+1).match(/^([A-Za-z_][A-Za-z0-9_]*)/);
      if(!match){out+='$';i++;continue;}end=i+1+match[0].length;
    }
    var key=match[1],op=match[2]||'',exists=own(env,key),nonempty=exists&&env[key]!=='';
    var active=op[0]===':'?nonempty:exists;var kind=op.slice(-1),value;
    if(kind==='-')value=active?env[key]:interpolate(match[3]||'',env,path,depth+1);
    else if(kind==='+')value=active?interpolate(match[3]||'',env,path,depth+1):'';
    else if(kind==='?'){if(!active)fail(path,'missing required .env variable '+key);value=env[key];}
    else{if(!exists)fail(path,'missing .env variable '+key);value=env[key];}
    out+=value;i=end;
    if(out.length>MAX_INPUT)fail(path,'expanded value exceeds limit');
  }
  return out;
}
function parseEnv(text) {
  input(text,'.env');text=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');var env={},i=0,line=1;
  while(i<text.length){
    while(text[i]===' '||text[i]==='\t'||text[i]==='\n'){if(text[i]==='\n')line++;i++;}
    if(i>=text.length)break;
    if(text[i]==='#'){while(i<text.length&&text[i]!=='\n')i++;continue;}
    var start=line,m=text.slice(i).match(/^(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)[ \t]*=[ \t]*/);
    if(!m)fail('.env line '+start,'expected KEY=value');var key=m[1];i+=m[0].length;
    if(key==='__proto__'||key==='constructor'||key==='prototype'||own(env,key))fail('.env line '+start,'duplicate or unsafe key');
    var value='',quote=text[i];
    if(quote==='"'||quote==="'"){
      i++;var closed=false;
      while(i<text.length){var c=text[i++];if(c===quote){closed=true;break;}
        if(c==='\\'&&i<text.length){var next=text[i];if(next===quote||next==='\\'){value+=next;i++;continue;}if(quote==='"'&&/[nrt]/.test(next)){value+=({n:'\n',r:'\r',t:'\t'})[next];i++;continue;}}
        if(c==='\n')line++;value+=c;
      }
      if(!closed)fail('.env line '+start,'unclosed quoted value');
      while(text[i]===' '||text[i]==='\t')i++;
      if(i<text.length&&text[i]!=='#'&&text[i]!=='\n')fail('.env line '+line,'unexpected text after quoted value');
      if(text[i]==='#')while(i<text.length&&text[i]!=='\n')i++;
    }else{
      var stop=text.indexOf('\n',i);if(stop<0)stop=text.length;value=text.slice(i,stop).replace(/[ \t]+#.*$/,'').trim();i=stop;
    }
    env[key]=quote==="'"?value:interpolate(value,env,'.env line '+start);
  }
  return env;
}
function serviceEnv(service,path) {
  var source=service.environment||{},result={};
  if(Array.isArray(source))source.forEach(function(entry){if(typeof entry!=='string'||entry.indexOf('=')<1)fail(path+'.environment','host-inherited variables are unsupported; specify values in .env');var at=entry.indexOf('='),key=entry.slice(0,at);if(own(result,key))fail(path+'.environment','duplicate key');result[key]=entry.slice(at+1);});
  else if(object(source))Object.keys(source).forEach(function(key){if(source[key]===null||typeof source[key]==='object')fail(path+'.environment','explicit scalar values are required');result[key]=String(source[key]);});
  else fail(path+'.environment','expected mapping or KEY=value list');
  return result;
}
function mount(value,path) {
  if(typeof value==='string'){var p=value.split(':');if(p.length<2||p.length>3)fail(path,'anonymous or ambiguous mount is unsupported');return {source:p[0],target:p[1],type:/^(?:\.|\/|~)/.test(p[0])?'bind':'volume',read_only:p[2]==='ro',options:p[2]||''};}
  if(!object(value)||!value.source||!value.target)fail(path,'explicit mount source and target required');return value;
}
function mounts(service,path){if(service.volumes!==undefined&&!Array.isArray(service.volumes))fail(path+'.volumes','expected list');return (service.volumes||[]).map(function(v){return mount(v,path+'.volumes');});}
function networkList(service,path){var n=service.networks||[];if(Array.isArray(n))return n;if(object(n)){Object.keys(n).forEach(function(k){if(n[k]!==null&&(!object(n[k])||Object.keys(n[k]).length))fail(path+'.networks','custom network attachment options require manual review');});return Object.keys(n);}fail(path+'.networks','invalid network list');}
function dbInfo(value,path) {
  var u;try {u=new URL(value);if(!/^postgres(?:ql)?:$/.test(u.protocol)||!u.hostname||!u.username||!u.pathname.slice(1))throw new Error();return {dbUser:decodeURIComponent(u.username),dbPassword:decodeURIComponent(u.password),dbHost:u.hostname,dbPort:Number(u.port||5432),dbName:decodeURIComponent(u.pathname.slice(1)),dbSslmode:u.searchParams.get('sslmode')||''};}catch(e){fail(path,'valid PostgreSQL URL with username and database required');}
}
function normalizeRoot(root) {if(typeof root!=='string'||root.indexOf('..')!==-1||root[0]==='~')fail('MYRIAD_COMPOSE_HOST_ROOT','use original deployment directory without parent traversal');return root.replace(/\/+$/,'')||'/';}
function inspectLegacy(composeText,envText) {
  var env=parseEnv(envText),compose=mapTree(parseYaml(composeText),function(v){return interpolate(v,env,'compose');});
  var report={preserved:[],added:[],warnings:[]},statePatch={};
  Object.keys(compose).forEach(function(k){if(['services','name','version','networks','volumes'].indexOf(k)<0)fail('compose','unsupported top-level field; merge manually before upgrading');});
  var services=compose.services;
  Object.keys(services).forEach(function(name){if(SERVICES.indexOf(name)<0)fail('compose.services','custom service requires a manual upgrade; keep its configuration separately');if(!object(services[name]))fail('services.'+name,'expected mapping');var s=services[name];Object.keys(s).forEach(function(k){if(KNOWN_FIELDS.indexOf(k)<0)fail('services.'+name,'unsupported field; inspect custom service options before upgrading');});s.environment=serviceEnv(s,'services.'+name);});
  if(!services.backend)fail('services.backend','recognized Myriad backend is required');
  var be=services.backend.environment;
  if(!be.DATABASE_URL)fail('services.backend.environment.DATABASE_URL','existing database URL required; refusing to create a new database identity');
  if(!be.JWT_SECRET)fail('services.backend.environment.JWT_SECRET','existing JWT secret required; refusing to reset authentication');
  var db=dbInfo(be.DATABASE_URL,'services.backend.environment.DATABASE_URL');Object.assign(statePatch,db);
  statePatch.dbMode=services.postgres?'bundled':'external';
  Object.keys(STATE_KEYS).forEach(function(k){if(own(env,k))statePatch[STATE_KEYS[k]]=env[k];});
  ['JWT_SECRET','MYRIAD_SETUP_SECRET','ANALYTICS_SALT','UPDATER_GATEWAY_SECRET','PERSONA_DB_PASSWORD','FEDERATION_DB_PASSWORD'].forEach(function(k){if(own(be,k))statePatch[STATE_KEYS[k]]=be[k];});
  if(services.updater&&services.updater.environment.UPDATE_TOKEN)statePatch.updateToken=services.updater.environment.UPDATE_TOKEN;
  ['updater','docker-guard'].forEach(function(name){if(services[name]&&services[name].environment.DOCKER_GUARD_SELF_UPDATE_TOKEN)statePatch.guardSelfUpdateToken=services[name].environment.DOCKER_GUARD_SELF_UPDATE_TOKEN;});
  var project=env.COMPOSE_PROJECT_NAME||compose.name||env.GUARD_COMPOSE_PROJECT_NAME;
  if(!project)fail('COMPOSE_PROJECT_NAME','set the existing Compose project name in the imported .env to keep named volumes; do not guess a new name');
  if(!/^[a-z0-9][a-z0-9_-]*$/.test(project))fail('COMPOSE_PROJECT_NAME','invalid project name');
  if(env.GUARD_COMPOSE_PROJECT_NAME&&env.GUARD_COMPOSE_PROJECT_NAME!==project)fail('GUARD_COMPOSE_PROJECT_NAME','must match the existing Compose project');
  var root=env.MYRIAD_COMPOSE_HOST_ROOT;
  if(!root&&services.updater){var deploymentMount=mounts(services.updater,'services.updater').filter(function(m){return m.target==='/host/compose';})[0];if(deploymentMount)root=deploymentMount.source;}
  root=normalizeRoot(root||'.');
  statePatch.composeHostRoot=root[0]==='/'?root:'';
  if(!statePatch.composeHostRoot)report.warnings.push('Enter the original absolute deployment directory before generating; relative paths must continue to point to the existing pgdata/state directories.');
  var volumes=compose.volumes||{};
  if(!object(volumes))fail('compose.volumes','expected mapping');
  Object.keys(volumes).forEach(function(name){if(name!=='backend_data'&&name!=='backend_cache')fail('compose.volumes','unrecognized volume; retain it in a manual upgrade');var v=volumes[name]||{};if(!object(v))fail('compose.volumes','invalid volume definition');Object.keys(v).forEach(function(k){if(['driver','name','external','labels'].indexOf(k)<0)fail('compose.volumes','custom volume driver settings require manual upgrade');});if(v.driver&&v.driver!=='local')fail('compose.volumes','only local storage supported');if((v.name&&v.name!==project+'_'+name)||(v.external&&!v.name))fail('compose.volumes','volume identity differs from Guard project storage; manual migration required');});
  Object.keys(services).forEach(function(name){
    var s=services[name],path='services.'+name;
    if(WORKERS.indexOf(name)>=0){
      var allowed=WORKER_ENV.concat(name==='persona-worker'?['PERSONA_WEB_UPSTREAM','MYRIAD_MCP_GATEWAY_URL','MYRIAD_MCP_GATEWAY_TOKEN']:[]);
      Object.keys(s.environment).forEach(function(key){if(allowed.indexOf(key)<0)fail(path+'.environment','unsupported worker environment key; manual review required');});
      if(s.environment.PATH&&s.environment.PATH!=='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin')fail(path+'.environment.PATH','worker executable search path is fixed');
    }
    if(s.container_name&&s.container_name!=='myriad-'+name)fail(path+'.container_name','custom names require manual upgrade');
    if(s.network_mode&&!(name==='backend-volume-init'&&s.network_mode==='none'))fail(path+'.network_mode','custom network mode is unsupported');
    if(s.ports&&name!=='proxy')fail(path+'.ports','only proxy may publish a host port');
    if(WORKERS.indexOf(name)>=0&&s.command&&JSON.stringify(s.command)!==JSON.stringify(['/app/myriad-'+name]))fail(path+'.command','custom worker executable requires manual upgrade');
    ['DATA_DIR','CACHE_DIR'].forEach(function(key){var expected=key==='DATA_DIR'?'/app/data':name==='federation-worker'?'/tmp/cache':'/app/cache';if(s.environment[key]&&s.environment[key]!==expected)fail(path+'.environment.'+key,'custom data path requires manual migration');});
    if(name==='backend'){var storage=mounts(s,path);if(storage.length!==2||!storage.some(function(m){return m.source==='backend_data'&&m.target==='/app/data';})||!storage.some(function(m){return m.source==='backend_cache'&&m.target==='/app/cache';}))fail(path+'.volumes','both existing backend_data and backend_cache mounts are required');}
    if(s.command&&['postgres','docker-guard','persona-worker','federation-worker'].indexOf(name)<0)fail(path+'.command','custom command requires manual upgrade');
    if(s.entrypoint&&['docker-guard','updater-gateway'].indexOf(name)<0)fail(path+'.entrypoint','custom entrypoint requires manual upgrade');
    mounts(s,path).forEach(function(m){
      if(m.options&&!/^(?:ro|rw)$/.test(m.options))fail(path+'.volumes','custom mount options require manual upgrade');
      if(m.bind&&Object.keys(m.bind).some(function(k){return k!=='create_host_path';}))fail(path+'.volumes','custom bind options require manual upgrade');
      if(['backend','backend-volume-init','persona-worker','federation-worker'].indexOf(name)>=0){
        var fixed=m.type==='volume'&&((m.source==='backend_data'&&['/app/data','/app/data/federation','/app/data/federation_media','/app/data/media'].indexOf(m.target)>=0)||(m.source==='backend_cache'&&['/app/cache','/tmp/cache/images'].indexOf(m.target)>=0));
        if((name==='federation-worker'&&['/app/data/federation','/app/data/federation_media','/app/data/media','/tmp/cache/images'].indexOf(m.target)>=0)||(m.volume&&Object.keys(m.volume).length)){
          if(!m.volume)fail(path+'.volumes','fixed federation subpath and nocopy options are required; a full-volume mount would change the data location');
          var expectedSubpath={'/app/data/federation':'federation','/app/data/federation_media':'federation_media','/app/data/media':'media','/tmp/cache/images':'images'}[m.target];
          if(name!=='federation-worker'||!expectedSubpath||m.volume.subpath!==expectedSubpath||m.volume.nocopy!==true||Object.keys(m.volume).some(function(k){return k!=='subpath'&&k!=='nocopy';}))fail(path+'.volumes','custom volume subpath/options cannot be converted without changing stored data; manual migration required');
        }
        if(!fixed)fail(path+'.volumes','Guard requires original backend_data/backend_cache named volumes; custom binds/storage need manual migration');
        if(!own(volumes,m.source))fail(path+'.volumes','named volume definition missing');
      }else{
        var pairs={postgres:[['pgdata','/var/lib/postgresql']],proxy:[['state','/state']],updater:[['','/host/compose'],['.env','/host/compose/.env'],['state','/host/compose/state'],['pgdata','/host/compose/pgdata'],['guard-policy','/run/secrets']], 'docker-guard':[['','/host/compose'],['state','/host/state'],['guard-policy','/guard-policy']]};
        var allowed=name==='docker-guard'&&m.source==='/var/run/docker.sock'&&m.target==='/var/run/docker.sock';
        (pairs[name]||[]).forEach(function(p){if(m.type==='bind'&&(m.source===(p[0]?root+'/'+p[0]:root)||m.source===(p[0]?'./'+p[0]:'.'))&&m.target===p[1])allowed=true;});
        if(!allowed)fail(path+'.volumes','mount outside Guard fixed project paths; keep the original data and use a manual upgrade');
      }
    });
  });
  if(services.postgres){
    var pg=services.postgres,version=String(pg.image||'').match(/(?:^|\/)postgres:(\d+)(?:[.\-@]|$)/);
    if(!version||+version[1]<18)fail('services.postgres.image','PostgreSQL 18+ required; perform a separately backed-up major-version migration first');
    if(mounts(pg,'services.postgres').length!==1)fail('services.postgres.volumes','one existing pgdata bind required');
    statePatch.dbVersion=version[1];
    if(pg.environment.POSTGRES_PASSWORD!==undefined&&pg.environment.POSTGRES_PASSWORD!==db.dbPassword)fail('services.postgres.environment.POSTGRES_PASSWORD','does not match backend database credentials; resolve manually');
    ['POSTGRES_DB','POSTGRES_USER'].forEach(function(k){if(pg.environment[k]&&pg.environment[k]!==db[k==='POSTGRES_DB'?'dbName':'dbUser'])fail('services.postgres.environment.'+k,'does not match backend database URL');});
    if(db.dbHost!=='postgres')fail('services.backend.environment.DATABASE_URL','bundled deployment must address the existing postgres service');
  }
  var nets=compose.networks||{},extra=false,extraNetworkName='';
  if(!object(nets))fail('compose.networks','expected mapping');
  Object.keys(nets).forEach(function(key){
    var n=nets[key]||{};if(!object(n))fail('compose.networks','invalid definition');
    if(CORE_NETS.indexOf(key)<0){if(n.external!==true||typeof n.name!=='string'||!NETWORK_NAME.test(n.name))fail('compose.networks','external database network must be external:true with a valid Docker network name; attach the database there and update this file before importing');extra=true;extraNetworkName=n.name;}
  });
  Object.keys(services).forEach(function(name){networkList(services[name],'services.'+name).forEach(function(k){if(!own(nets,k))fail('services.'+name+'.networks','network definition missing');if(CORE_NETS.indexOf(k)<0&&['backend'].concat(WORKERS).indexOf(name)<0)fail('services.'+name+'.networks','only the three database clients may join the external database network');});});
  CORE_NETS.forEach(function(k,index){if(nets[k])statePatch[['netMyriad','netAdmin','netGuard'][index]]=nets[k].name||(nets[k].external?k:project+'_'+k);});
  if(extra)statePatch.dbExtraNetwork=extraNetworkName;
  if(be.BASE_URL||be.FRONTEND_URL){try{statePatch.mainDomain=new URL(be.BASE_URL||be.FRONTEND_URL).hostname;}catch(e){fail('services.backend.environment.BASE_URL','invalid public URL');}}
  if(services.proxy&&services.proxy.ports){if(!Array.isArray(services.proxy.ports)||services.proxy.ports.length!==1||typeof services.proxy.ports[0]!=='string')fail('services.proxy.ports','one short-syntax HTTP port required');var port=services.proxy.ports[0].match(/^(?:(\d+\.\d+\.\d+\.\d+):)?(\d+):80(?:\/tcp)?$/);if(!port)fail('services.proxy.ports','unsupported public port mapping');statePatch.httpBindAddress=port[1]||'0.0.0.0';statePatch.httpPort=Number(port[2]);}
  WORKERS.forEach(function(name){
    var passwordKey=name==='persona-worker'?'PERSONA_DB_PASSWORD':'FEDERATION_DB_PASSWORD';
    var urlKey=name==='persona-worker'?'PERSONA_DATABASE_URL':'FEDERATION_DATABASE_URL';
    var existingUrl=(services[name]&&services[name].environment.DATABASE_URL)||env[urlKey];
    if(existingUrl){
      var info=dbInfo(existingUrl,'services.'+name+'.environment.DATABASE_URL');
      if(be[passwordKey]&&be[passwordKey]!==info.dbPassword)fail('services.backend.environment.'+passwordKey,'worker bootstrap password conflicts with its existing database URL');
      if(info.dbUser===db.dbUser)fail('services.'+name+'.environment.DATABASE_URL','worker requires an independent database login');
      if(statePatch.dbMode==='bundled')statePatch[name==='persona-worker'?'personaDbPassword':'federationDbPassword']=info.dbPassword;
    }
  });
  report.preserved.push('Existing database URL, authentication secrets, project identity, and data mounts');
  if(!env.COMPOSE_PROJECT_NAME)report.warnings.push('Keep running Compose with the same existing project name and deployment directory.');
  if(statePatch.dbMode==='external')report.warnings.push('External PostgreSQL version, role privileges, and reachability require operator verification; they cannot be inspected from these files.');
  report.warnings.push('Back up PostgreSQL and data volumes before applying; do not delete volumes or initialize a new deployment directory.');
  return {compose:compose,env:env,statePatch:statePatch,report:report,project:project,root:root,extraNetwork:extra};
}
function serializeEnv(env){return '# Upgrade output: contains existing secrets. Keep private.\n'+Object.keys(env).map(function(key){return key+"='"+String(env[key]).replace(/\\/g,'\\\\').replace(/'/g,"\\'")+"'";}).join('\n')+'\n';}
function upgradeGenerated(generated,legacy) {
  if(!legacy||!legacy.compose||!legacy.env)fail('upgrade','inspect both existing files before generating');
  var env=parseEnv(generated.env),report=clone(legacy.report),old=legacy.compose,compose;
  var confirmedRoot=legacy.root[0]==='/'?legacy.root:env.MYRIAD_COMPOSE_HOST_ROOT;
  if(!confirmedRoot||confirmedRoot[0]!=='/')fail('MYRIAD_COMPOSE_HOST_ROOT','enter the original absolute deployment directory before generating');
  confirmedRoot=normalizeRoot(confirmedRoot);
  Object.keys(legacy.env).forEach(function(key){if(!TARGET_ENV.test(key))env[key]=legacy.env[key];});
  var be=old.services.backend.environment;
  env.DATABASE_URL=be.DATABASE_URL;
  Object.keys(STATE_KEYS).forEach(function(key){var stateKey=STATE_KEYS[key];if(own(legacy.statePatch,stateKey)&&/SECRET|TOKEN|SALT|PASSWORD/.test(key))env[key]=legacy.statePatch[stateKey];});
  env.COMPOSE_PROJECT_NAME=legacy.project;env.GUARD_COMPOSE_PROJECT_NAME=legacy.project;env.MYRIAD_COMPOSE_HOST_ROOT=confirmedRoot;env.MYRIAD_DB_MODE=legacy.statePatch.dbMode;
  if(old.services.postgres){['POSTGRES_DB','POSTGRES_USER','POSTGRES_PASSWORD'].forEach(function(key){if(own(old.services.postgres.environment,key))env[key]=old.services.postgres.environment[key];});}
  ['MYRIAD_DOCKER_NETWORK','MYRIAD_ADMIN_NETWORK','MYRIAD_DOCKER_GUARD_NETWORK'].forEach(function(key,index){var value=legacy.statePatch[['netMyriad','netAdmin','netGuard'][index]];if(value){env[key]=value;env['GUARD_'+key]=value;}});
  WORKERS.forEach(function(name){var key=name==='persona-worker'?'PERSONA_DATABASE_URL':'FEDERATION_DATABASE_URL';if(old.services[name]&&old.services[name].environment.DATABASE_URL)env[key]=old.services[name].environment.DATABASE_URL;});
  var generatedCompose=parseYaml(generated.compose);
  compose=mapTree(generatedCompose,function(v){return interpolate(v,env,'generated compose');});
  compose.name=legacy.project;
  if(legacy.statePatch.dbMode==='external')delete compose.services.postgres;
  Object.keys(old.services).forEach(function(name){
    var previous=old.services[name],next=compose.services[name];if(!next)fail('generated.services.'+name,'required existing service missing');
    ['command','entrypoint'].forEach(function(key){if(name!=='postgres'&&previous[key]!==undefined&&JSON.stringify(previous[key])!==JSON.stringify(next[key]))fail('services.'+name+'.'+key,'custom executable differs from the current topology; manual review required');});
    next.environment=serviceEnv(next,'generated.services.'+name);
    Object.keys(previous.environment).forEach(function(key){if(!MANAGED_ENV.test(key)&&!TARGET_ENV.test(key))next.environment[key]=previous.environment[key];});
    SAFE_FIELDS.forEach(function(key){if(own(previous,key)){
      if(WORKERS.indexOf(name)>=0&&['healthcheck','deploy'].indexOf(key)>=0&&JSON.stringify(previous[key])!==JSON.stringify(next[key]))fail('services.'+name+'.'+key,'existing worker setting conflicts with current Guard bounds; review and use the current worker configuration');
      next[key]=clone(previous[key]);
    }});
    if(name==='postgres'){next.image=previous.image;next.volumes=clone(previous.volumes);if(previous.command)next.command=clone(previous.command);if(previous.healthcheck)next.healthcheck=clone(previous.healthcheck);}
    if(name==='proxy'&&previous.ports)next.ports=clone(previous.ports);
    // The current template owns role, command, isolation, mount permissions, dependencies and routing.
  });
  if(legacy.statePatch.dbMode==='external'){
    ['PERSONA_DB_PASSWORD','FEDERATION_DB_PASSWORD'].forEach(function(key){if(!be[key])delete compose.services.backend.environment[key];});
    report.warnings.push('Provision missing external worker roles independently. Backend role management remains disabled unless explicitly present in the old backend configuration.');
  }
  var bootstrapPersona=compose.services.backend.environment.PERSONA_DB_PASSWORD||'';
  var bootstrapFederation=compose.services.backend.environment.FEDERATION_DB_PASSWORD||'';
  if((bootstrapPersona||bootstrapFederation)&&(!bootstrapPersona||!bootstrapFederation))fail('services.backend.environment','both worker bootstrap passwords must be provided as a pair, or both omitted for preprovisioned external roles');
  if(bootstrapPersona&&(bootstrapPersona===bootstrapFederation||bootstrapPersona===legacy.statePatch.dbPassword||bootstrapFederation===legacy.statePatch.dbPassword))fail('services.backend.environment','worker bootstrap passwords must be independent and distinct from the administrator password');
  ['PERSONA_DB_PASSWORD','FEDERATION_DB_PASSWORD'].forEach(function(key){
    var password=compose.services.backend.environment[key];
    if(password&&!/^[A-Za-z0-9_-]{32,128}$/.test(password))fail('services.backend.environment.'+key,'backend-managed worker passwords require 32–128 URL-safe characters; use independently preprovisioned external roles for other credentials');
  });
  compose.volumes=clone(old.volumes||{});
  compose.networks=compose.networks||{};
  CORE_NETS.forEach(function(key){if(old.networks&&old.networks[key])compose.networks[key]=clone(old.networks[key]);});
  if(legacy.extraNetwork){
    var extraNetworkName=legacy.statePatch.dbExtraNetwork||'myriad-backend-ext';
    compose.networks['myriad-backend-ext']={name:extraNetworkName,external:true};env.MYRIAD_BACKEND_EXTRA_NETWORK=extraNetworkName;
    ['backend'].concat(WORKERS).forEach(function(name){var n=networkList(compose.services[name],'generated.services.'+name);if(n.indexOf('myriad-backend-ext')<0)n.push('myriad-backend-ext');compose.services[name].networks=n;});
  }
  WORKERS.forEach(function(name){
    var next=compose.services[name];if(!next)fail('generated.services.'+name,'current worker topology required');
    if(old.services.backend.extra_hosts&&!next.extra_hosts)next.extra_hosts=clone(old.services.backend.extra_hosts);
    var urlKey=name==='persona-worker'?'PERSONA_DATABASE_URL':'FEDERATION_DATABASE_URL';
    var passwordKey=name==='persona-worker'?'PERSONA_DB_PASSWORD':'FEDERATION_DB_PASSWORD';
    if(old.services[name]&&old.services[name].environment.DATABASE_URL)next.environment.DATABASE_URL=old.services[name].environment.DATABASE_URL;
    else if(legacy.env[urlKey])next.environment.DATABASE_URL=legacy.env[urlKey];
    else{
      if(legacy.statePatch.dbMode==='external'&&!be[passwordKey])fail('legacy.env.'+urlKey,'preprovision an independent worker role and provide its existing database URL before upgrading; backend role management is disabled');
      if(!env[passwordKey])fail('generated.env.'+passwordKey,'new independent worker password required');
      var workerUrl=new URL(be.DATABASE_URL);workerUrl.username=name==='persona-worker'?'myriad_persona':'myriad_federation';workerUrl.password=encodeURIComponent(env[passwordKey]);
      next.environment.DATABASE_URL=workerUrl.toString();
    }
    var workerInfo=dbInfo(next.environment.DATABASE_URL,'generated.services.'+name+'.environment.DATABASE_URL');
    if(workerInfo.dbUser===legacy.statePatch.dbUser)fail('generated.services.'+name+'.environment.DATABASE_URL','worker requires an independent database login');
    env[urlKey]=next.environment.DATABASE_URL;
    if(!old.services[name])report.added.push(name+' with an independent database login and current storage/network isolation');
  });
  if(old.services.postgres)report.preserved.push('PostgreSQL image and original pgdata bind retained without a major-version change');
  report.preserved.push('Extra .env keys and supported service settings retained; application image versions come from current generation');
  report.warnings.push('Current role/routing/dependencies and Guard isolation replace legacy topology. Review the generated Compose diff before applying.');
  var guard=parseEnv(generated.guardEnv||'');
  Object.keys(guard).forEach(function(key){if(own(env,key))guard[key]=env[key];});guard.COMPOSE_PROJECT_NAME=legacy.project;
  if(env.GUARD_SELF_UPDATE_TOKEN)guard.DOCKER_GUARD_SELF_UPDATE_TOKEN=env.GUARD_SELF_UPDATE_TOKEN;
  // Compose interpolates even quoted YAML scalars. Escape literal dollars after all resolution.
  var escaped=mapTree(compose,function(v){return v.replace(/\$/g,'$$$$');});
  Object.keys(escaped.services).forEach(function(name){
    if(name!=='postgres')escaped.services[name].image=generatedCompose.services[name].image;
    var values=compose.services[name].environment||{};
    Object.keys(values).forEach(function(key){if(own(env,key)&&String(values[key])===String(env[key]))escaped.services[name].environment[key]='${'+key+'}';});
    if(WORKERS.indexOf(name)>=0)escaped.services[name].environment.DATABASE_URL='${'+(name==='persona-worker'?'PERSONA_DATABASE_URL':'FEDERATION_DATABASE_URL')+'}';
    if(values.DOCKER_GUARD_EXPECTED_IMAGE)escaped.services[name].environment.DOCKER_GUARD_EXPECTED_IMAGE=generatedCompose.services[name].environment.DOCKER_GUARD_EXPECTED_IMAGE;
  });
  var output=yaml.dump(escaped,{schema:yaml.CORE_SCHEMA,noRefs:true,lineWidth:-1,noCompatMode:true});
  return {compose:output,env:serializeEnv(env),guardEnv:serializeEnv(guard),deploy:String(generated.deploy||'')+'\n\n## Existing deployment upgrade\n\nKeep the original deployment directory and project name. Back up PostgreSQL and data volumes. Review the Compose diff, verify with `docker compose --env-file .env config`, then apply with `docker compose --env-file .env up -d`. Never delete data volumes or initialize fresh storage during this upgrade.\n'+['preserved','added','warnings'].map(function(kind){return '\n### '+kind+'\n\n'+report[kind].map(function(item){return '- '+item;}).join('\n')+'\n';}).join(''),report:report};
}
module.exports={parseEnv:parseEnv,inspectLegacy:inspectLegacy,upgradeGenerated:upgradeGenerated};
