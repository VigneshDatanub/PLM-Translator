// =============================================================
// PLM Translator - UI5 Application Component (Component.js)
// =============================================================
// The Component is the independent, reusable controller unit in SAPUI5.
// It initializes routing, sets up models (device, appModel), and
// loads initial global data like the supported languages list and
// current user information from the CAP OData service.
// Compatible with Standalone Approuter and SAP Build Work Zone.
// =============================================================

sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "sap/ui/model/json/JSONModel",
    "plm/translator/app/controller/BaseController",
    "plm/translator/app/controller/App.controller",
    "plm/translator/app/controller/Translator.controller",
    "plm/translator/app/controller/MassTranslation.controller",
    "plm/translator/app/controller/TestResults.controller"
], function (UIComponent, Device, JSONModel) {
    "use strict";

    return UIComponent.extend("plm.translator.app.Component", {
        metadata: {
            manifest: "json"
        },

        /**
         * Resolves API and asset URLs dynamically to support SAP Build Work Zone Launchpad.
         */
        getApiUrl: function (sPath) {
            var sModulePath = sap.ui.require.toUrl("plm/translator/app");
            if (!sModulePath || sModulePath === ".") {
                return sPath.startsWith("/") ? sPath : "/" + sPath;
            }
            var sCleanPath = sPath.startsWith("/") ? sPath.slice(1) : sPath;
            return sModulePath + "/" + sCleanPath;
        },

        /**
         * The component is initialized by UI5 automatically during the startup of the app.
         */
        init: function () {
            // Call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // Enable routing based on hash navigation defined in manifest.json
            this.getRouter().initialize();

            // Set the device model for responsive design checks (e.g. device>/system/phone)
            const oDeviceModel = new JSONModel(Device);
            oDeviceModel.setDefaultBindingMode("OneWay");
            this.setModel(oDeviceModel, "device");

            // Pre-load global data needed across views:
            // 1. Languages list from Google Translation API
            // 2. User information from backend / BTP environment
            this._loadInitialData();
        },

        /**
         * Fetch supported languages and user info on app startup
         */
        _loadInitialData: function () {
            const oAppModel = this.getModel("appModel");
            const that = this;
            // Set size limit to 1000 so all 196+ languages are displayed without UI5's default 100-item truncation
            oAppModel.setSizeLimit(1000);

            // 1. Pre-seed languages from bundled cache so UI never shows 'No data'
            fetch(this.getApiUrl("model/languages.json"))
                .then(function (res) {
                    if (res.ok) return res.json();
                    return null;
                })
                .then(function (aPreseeded) {
                    if (Array.isArray(aPreseeded) && aPreseeded.length > 0) {
                        var current = oAppModel.getProperty("/languages");
                        if (!current || current.length === 0) {
                            oAppModel.setProperty("/languages", aPreseeded);
                        }
                    }
                })
                .catch(function () {});

            // 2. Fetch supported languages list dynamically from CAP function /api/getLanguages()
            fetch(this.getApiUrl("/api/getLanguages()"))
                .then(function (response) {
                    if (!response.ok) {
                        throw new Error("HTTP error " + response.status);
                    }
                    return response.json();
                })
                .then(function (data) {
                    var aLanguages = (data && data.value) ? data.value : [];
                    if (Array.isArray(aLanguages) && aLanguages.length > 0) {
                        oAppModel.setProperty("/languages", aLanguages);
                        console.log("[Component] Loaded " + aLanguages.length + " dynamic languages from Google API");
                    }
                })
                .catch(function (error) {
                    console.warn("[Component] Error loading dynamic languages from CAP:", error);
                    // Do not wipe out languages if already pre-seeded
                    var curLangs = oAppModel.getProperty("/languages");
                    if (!curLangs || curLangs.length === 0) {
                        fetch(that.getApiUrl("model/languages.json"))
                            .then(function (res) { return res.json(); })
                            .then(function (langs) {
                                if (Array.isArray(langs)) {
                                    oAppModel.setProperty("/languages", langs);
                                }
                            })
                            .catch(function () {});
                    }
                });

            // 3. Fetch logged-in / system user information from /api/getUserInfo() (CIS / IAS Profile)
            fetch(this.getApiUrl("/api/getUserInfo()"))
                .then(function (response) {
                    return response.json();
                })
                .then(function (data) {
                    if (data && data.user) {
                        oAppModel.setProperty("/userInfo", data);
                        oAppModel.setProperty("/currentUser", data.user);
                        if (data.email) {
                            oAppModel.setProperty("/currentUserEmail", data.email);
                        }
                        if (data.roles) {
                            oAppModel.setProperty("/roles", data.roles);
                        }
                    }
                })
                .catch(function (error) {
                    console.warn("[Component] Error loading user info, using default:", error);
                    oAppModel.setProperty("/currentUser", "PLM Tester");
                });
        },

        destroy: function () {
            UIComponent.prototype.destroy.apply(this, arguments);
        }
    });
});
