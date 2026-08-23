function startMinecraftWidget(){return globalThis.MinecraftHub.initWidget()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startMinecraftWidget)
else setTimeout(startMinecraftWidget,0)
