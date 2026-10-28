// =============================================================
// PLM Translator - Root App Controller (App.controller.js)
// =============================================================
// Synchronizes the top navigation SegmentedButton with UI5 routing.
// When user clicks a tab or navigates via URL hash, the active
// view changes and the top header stays synchronized.
// =============================================================

sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("plm.translator.app.controller.App", {

        onInit: function () {
            // Listen to route matched events to update the selected key in the header
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.attachRouteMatched(this._onRouteMatched, this);
        },

        /**
         * Keeps the header navigation buttons synchronized with the current route
         */
        _onRouteMatched: function (oEvent) {
            var sRouteName = oEvent.getParameter("name");
            var oSegmentedBtn = this.byId("navSegmentedBtn");
            if (oSegmentedBtn && sRouteName) {
                oSegmentedBtn.setSelectedKey(sRouteName);
            }
        },

        /**
         * User clicked on a navigation tab in the top header
         */
        onNavSelect: function (oEvent) {
            var oItem = oEvent.getParameter("item");
            var sKey = oItem ? oItem.getKey() : (oEvent.getSource().getSelectedKey ? oEvent.getSource().getSelectedKey() : null);

            if (!sKey) {
                return;
            }

            var oRouter = this.getOwnerComponent().getRouter();
            if (oRouter) {
                oRouter.navTo(sKey);
            }

            // Direct hash navigation fallback so tab click is 100% responsive
            if (sKey === "translator") {
                window.location.hash = "#/";
            } else if (sKey === "massTranslation") {
                window.location.hash = "#/mass-translation";
            } else if (sKey === "testResults") {
                window.location.hash = "#/test-results";
            }
        }
    });
});
