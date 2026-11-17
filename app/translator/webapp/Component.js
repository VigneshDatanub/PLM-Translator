// =============================================================
// PLM Translator - SAP Fiori Elements AppComponent (Component.js)
// =============================================================
// 100% Strict SAP Fiori Elements (OData V4) AppComponent
// Extends sap.fe.core.AppComponent and loads standard metadata
// and extensions for the List Report & Object Page floorplan.
// =============================================================

sap.ui.define([
    "sap/fe/core/AppComponent"
], function (AppComponent) {
    "use strict";

    return AppComponent.extend("plm.translator.app.Component", {
        metadata: {
            manifest: "json"
        },

        init: function () {
            AppComponent.prototype.init.apply(this, arguments);

            // Ensure SheetJS is preloaded when running embedded in SAP Fiori Launchpad / SAP Build Work Zone
            if (typeof window !== "undefined" && (!window.XLSX || !window.XLSX.utils)) {
                try {
                    var sUrl = sap.ui.require.toUrl("plm/translator/app/libs/xlsx.full.min.js");
                    if (!document.getElementById("plm-xlsx-bundle")) {
                        var oScript = document.createElement("script");
                        oScript.id = "plm-xlsx-bundle";
                        oScript.type = "text/javascript";
                        oScript.src = sUrl;
                        document.head.appendChild(oScript);
                    }
                } catch (e) {
                    console.warn("[PLM Component] Preloading SheetJS:", e);
                }
            }
        }
    });
});
