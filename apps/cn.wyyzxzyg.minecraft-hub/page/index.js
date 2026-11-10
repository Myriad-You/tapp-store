var PlayerProfiles=require('./player.js');
Tapp.lifecycle.onReady(async function(){await globalThis.MinecraftHub.init();await PlayerProfiles.init()});
if(Tapp.lifecycle.onDestroy)Tapp.lifecycle.onDestroy(function(){PlayerProfiles.destroy()});
