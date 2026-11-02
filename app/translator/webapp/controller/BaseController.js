// =============================================================
// PLM Translator - Base Controller (BaseController.js)
// =============================================================
// Provides common helper methods for all view controllers:
// 1. getApiUrl: Automatically resolves API endpoints and asset URLs
//    whether running standalone, local, or inside SAP Build Work Zone
// 2. Convenience accessors for models and resource bundles
// =============================================================

sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("plm.translator.app.controller.BaseController", {

        /**
         * Resolves API and asset URLs dynamically to support SAP Build Work Zone Launchpad.
         * In Work Zone, the HTML5 Application Repository routes requests through
         * the app's base URL rather than the root domain.
         */
        getApiUrl: function (sPath) {
            var oComponent = this.getOwnerComponent();
            if (oComponent && typeof oComponent.getApiUrl === "function") {
                return oComponent.getApiUrl(sPath);
            }
            var sModulePath = sap.ui.require.toUrl("plm/translator/app");
            if (!sModulePath || sModulePath === ".") {
                return sPath.startsWith("/") ? sPath : "/" + sPath;
            }
            var sCleanPath = sPath.startsWith("/") ? sPath.slice(1) : sPath;
            return sModulePath + "/" + sCleanPath;
        },

        /**
         * Convenience getter for models
         */
        getModel: function (sName) {
            return this.getView().getModel(sName) || (this.getOwnerComponent() && this.getOwnerComponent().getModel(sName));
        }
    });
});

