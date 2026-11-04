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
        }
    });
});
