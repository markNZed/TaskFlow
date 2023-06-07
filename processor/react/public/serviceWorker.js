if ( 'function' === typeof importScripts) {

    /* eslint-disable no-undef */
    importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.2.4/workbox-sw.js');
    /* eslint-disable no-undef */

    // This must come before any other workbox.* methods.
    workbox.setConfig({
      debug: true
    });

    console.log("workbox imported");

    const self = /* globalThis */ this;
    // self.__WB_MANIFEST is undefined
    //workbox.precaching.precacheAndRoute(self.__WB_MANIFEST);


    self.addEventListener('fetch', onFetch); // Add fetch event listener
  
    function onFetch(event) {
      console.log('Intercepted fetch event:', event.request.url);
      event.respondWith(fetch(event.request));
    }
      
}
