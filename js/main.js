/* Main entrypoint — ensures core state is hydrated before shell boots. */
(function () {
  "use strict";
  if (window.DevinOS && DevinOS.FS) DevinOS.FS.load();
})();
