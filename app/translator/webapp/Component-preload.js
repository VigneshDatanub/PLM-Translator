//@ui5-bundle plm/translator/app/Component-preload.js
sap.ui.require.preload({
    "plm/translator/app/Component.js": function () {
// =============================================================
// PLM Translator - UI5 Application Component (Component.js)
// =============================================================
// The Component is the independent, reusable controller unit in SAPUI5.
// It initializes routing, sets up models (device, appModel), and
// loads initial global data like the supported languages list and
// current user information from the CAP OData service.
// Compatible with Standalone Approuter and SAP Build Work Zone.
// =============================================================

sap.ui.define("plm/translator/app/Component", [
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

    },
    "plm/translator/app/controller/App.controller.js": function () {
// =============================================================
// PLM Translator - Root App Controller (App.controller.js)
// =============================================================
// Synchronizes the top navigation SegmentedButton with UI5 routing.
// When user clicks a tab or navigates via URL hash, the active
// view changes and the top header stays synchronized.
// =============================================================

sap.ui.define("plm/translator/app/controller/App.controller", [
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
        }
    });
});

    },
    "plm/translator/app/controller/BaseController.js": function () {
// =============================================================
// PLM Translator - Base Controller (BaseController.js)
// =============================================================
// Provides common helper methods for all view controllers:
// 1. getApiUrl: Automatically resolves API endpoints and asset URLs
//    whether running standalone, local, or inside SAP Build Work Zone
// 2. Convenience accessors for models and resource bundles
// =============================================================

sap.ui.define("plm/translator/app/controller/BaseController", [
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


    },
    "plm/translator/app/controller/MassTranslation.controller.js": function () {
// =============================================================
// PLM Translator - Mass Translation Controller
// =============================================================
// Handles:
// 1. Downloading sample Excel template
// 2. Multi-language selection helpers
// 3. Uploading Excel workbook & triggering batch translation
// 4. Presenting execution KPIs (Total rows, Success %, etc.)
// 5. Previewing results & exporting session results to Excel
// Compatible with SAP Build Work Zone Launchpad.
// =============================================================

sap.ui.define("plm/translator/app/controller/MassTranslation.controller", [
    "plm/translator/app/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (BaseController, JSONModel, MessageToast, MessageBox) {
    "use strict";

    return BaseController.extend("plm.translator.app.controller.MassTranslation", {

        onInit: function () {
            // Local model for holding the current batch session results
            var oSessionModel = new JSONModel({
                sessionId: "",
                statistics: null,
                results: []
            });
            this.getView().setModel(oSessionModel, "sessionModel");
            this._selectedFile = null;
        },

        /**
         * Download blank Excel template
         */
        onDownloadTemplate: function () {
            var oLink = document.createElement("a");
            oLink.href = this.getApiUrl("/api/download-template-excel");
            oLink.download = "mass_translation_template.xlsx";
            document.body.appendChild(oLink);
            oLink.click();
            document.body.removeChild(oLink);
            MessageToast.show("Downloading Excel template...");
        },

        /**
         * Convenience helper: Select top 5 European / Asian languages
         */
        onSelectTopLanguages: function () {
            var oMultiCombo = this.byId("targetLanguagesMultiCombo");
            oMultiCombo.setSelectedKeys(["de", "fr", "es", "ja", "zh-CN"]);
            MessageToast.show("Selected 5 standard languages");
        },

        /**
         * Convenience helper: Clear language selection
         */
        onClearLanguages: function () {
            var oMultiCombo = this.byId("targetLanguagesMultiCombo");
            oMultiCombo.setSelectedKeys([]);
        },

        /**
         * Keep track of the selected file
         */
        onFileSelected: function (oEvent) {
            var oFileUploader = this.byId("excelFileUploader");
            var aFiles = oFileUploader.getDomRef("fu").files;
            if (aFiles && aFiles.length > 0) {
                this._selectedFile = aFiles[0];
                MessageToast.show("Selected: " + this._selectedFile.name);
            }
        },

        /**
         * Upload Excel and trigger batch translation via /api/upload-and-translate
         */
        onUploadAndTranslate: function () {
            var oFileUploader = this.byId("excelFileUploader");
            var aDomFiles = oFileUploader.getDomRef("fu") ? oFileUploader.getDomRef("fu").files : null;
            var oFile = (aDomFiles && aDomFiles.length > 0) ? aDomFiles[0] : this._selectedFile;

            if (!oFile) {
                MessageBox.warning("Please choose an Excel file to upload.");
                return;
            }

            var oMultiCombo = this.byId("targetLanguagesMultiCombo");
            var aSelectedLanguages = oMultiCombo.getSelectedKeys();

            if (!aSelectedLanguages || aSelectedLanguages.length === 0) {
                MessageBox.warning("Please select at least one target language.");
                return;
            }

            var sTestedBy = this.byId("massTestedByInput").getValue();
            if (!sTestedBy || !sTestedBy.trim()) {
                MessageBox.warning("Please specify who is running/evaluating this test.");
                return;
            }

            var oBtn = this.byId("btnUploadAndTranslate");
            oBtn.setBusy(true);

            // Construct multipart/form-data
            var formData = new FormData();
            formData.append("file", oFile);
            formData.append("target_languages", JSON.stringify(aSelectedLanguages));
            formData.append("tested_by", sTestedBy.trim());

            var that = this;

            fetch(this.getApiUrl("/api/upload-and-translate"), {
                method: "POST",
                body: formData
            })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                oBtn.setBusy(false);

                if (data.success) {
                    var sSessionId = data.sessionId;
                    var oStats = data.statistics || {};

                    // Update KPI cards
                    that.byId("kpiTotalRows").setText(oStats.totalRows || 0);
                    that.byId("kpiSuccessful").setText(oStats.successful || 0);
                    that.byId("kpiFailed").setText(oStats.failed || 0);
                    that.byId("kpiSuccessRate").setText((oStats.successRate || 0) + "%");

                    // Show KPI and table sections
                    that.byId("statsSection").setVisible(true);
                    that.byId("resultsTableCard").setVisible(true);

                    // Update session model
                    var oSessionModel = that.getView().getModel("sessionModel");
                    oSessionModel.setProperty("/sessionId", sSessionId);
                    oSessionModel.setProperty("/statistics", oStats);

                    // Query the generated test results for this session from OData
                    that._loadSessionResults(sSessionId);

                    MessageBox.success("Mass translation completed! " + (oStats.successful || 0) + " items translated.");
                } else {
                    MessageBox.error("Mass translation failed: " + (data.error || "Unknown error"));
                }
            })
            .catch(function (error) {
                oBtn.setBusy(false);
                MessageBox.error("Network or server error during upload: " + error.message);
            });
        },

        /**
         * Fetch the translated items for this session from CAP OData
         */
        _loadSessionResults: function (sSessionId) {
            var oSessionModel = this.getView().getModel("sessionModel");
            var that = this;

            fetch(this.getApiUrl("/api/TestResults?$filter=sessionId eq '" + encodeURIComponent(sSessionId) + "'&$orderby=createdAt asc"))
                .then(function (response) {
                    return response.json();
                })
                .then(function (data) {
                    var aItems = (data && data.value) ? data.value : [];
                    var aFormatted = aItems.map(function (item, idx) {
                        return {
                            rowIndex: idx + 1,
                            outcome: item.outcome,
                            accuracy: item.accuracy,
                            targetLanguage: item.targetLanguage,
                            sourceText: item.textToTranslate,
                            translatedText: item.translatedText,
                            observation: item.observation
                        };
                    });
                    oSessionModel.setProperty("/results", aFormatted);
                })
                .catch(function (err) {
                    console.error("[MassTranslation] Error fetching session results:", err);
                });
        },

        /**
         * Download the Excel workbook containing all results for this session
         */
        onDownloadSessionResults: function () {
            var oSessionModel = this.getView().getModel("sessionModel");
            var sSessionId = oSessionModel.getProperty("/sessionId");

            if (!sSessionId) {
                MessageBox.warning("No session available to download.");
                return;
            }

            MessageToast.show("Generating Excel report for download...");

            // Submit a POST request to trigger browser download
            fetch(this.getApiUrl("/api/download-translation-results?session_id=" + encodeURIComponent(sSessionId)), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ session_id: sSessionId })
            })
            .then(async function (response) {
                if (!response.ok) {
                    var sErrMsg = "HTTP " + response.status;
                    try {
                        var oErr = await response.json();
                        if (oErr && oErr.error) {
                            sErrMsg = oErr.error;
                        }
                    } catch (e) {
                        // ignore JSON parse error
                    }
                    throw new Error(sErrMsg);
                }
                return response.blob();
            })
            .then(function (blob) {
                var url = window.URL.createObjectURL(blob);
                var a = document.createElement("a");
                a.href = url;
                a.download = "translation_results_" + sSessionId + ".xlsx";
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                MessageToast.show("Download started successfully");
            })
            .catch(function (error) {
                MessageBox.error("Could not download translation results: " + error.message);
            });
        }
    });
});

    },
    "plm/translator/app/controller/TestResults.controller.js": function () {
// =============================================================
// PLM Translator - Test Results Controller
// =============================================================
// Manages persisted test records:
// 1. Loading and calculating overall KPIs
// 2. Real-time client-side search and outcome filtering
// 3. Detailed record viewing dialog
// 4. Deleting records via OData DELETE /api/TestResults(ID)
// 5. Triggering Excel export via /api/export-results-excel
// Compatible with SAP Build Work Zone Launchpad.
// =============================================================

sap.ui.define("plm/translator/app/controller/TestResults.controller", [
    "plm/translator/app/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/VBox",
    "sap/m/Label",
    "sap/m/Text",
    "sap/m/TextArea"
], function (BaseController, JSONModel, MessageToast, MessageBox, Dialog, Button, VBox, Label, Text, TextArea) {
    "use strict";

    return BaseController.extend("plm.translator.app.controller.TestResults", {

        onInit: function () {
            // Model for holding raw + filtered items
            this._oResultsModel = new JSONModel({ items: [] });
            this.getView().setModel(this._oResultsModel, "resultsModel");

            // Model for KPI tiles
            this._oStatsModel = new JSONModel({
                totalTests: 0,
                successRate: 100,
                passedCount: 0,
                failedCount: 0
            });
            this.getView().setModel(this._oStatsModel, "resultsStatsModel");

            this._allItems = [];

            // Listen for route match so data is refreshed when user switches tabs
            var oRouter = this.getOwnerComponent().getRouter();
            if (oRouter) {
                var oRoute = oRouter.getRoute("testResults");
                if (oRoute) {
                    oRoute.attachPatternMatched(this._onRouteMatched, this);
                }
            }

            this._loadData();
        },

        _onRouteMatched: function () {
            this._loadData();
        },

        onRefreshData: function () {
            this._loadData();
            MessageToast.show("Test results refreshed");
        },

        /**
         * Load all test results from CAP OData endpoint
         */
        _loadData: function () {
            var that = this;
            var oTable = this.byId("testResultsTable");
            if (oTable) {
                oTable.setBusy(true);
            }

            fetch(this.getApiUrl("/api/TestResults?$orderby=createdAt desc"))
                .then(function (response) {
                    if (!response.ok) {
                        throw new Error("HTTP error " + response.status);
                    }
                    return response.json();
                })
                .then(function (data) {
                    if (oTable) {
                        oTable.setBusy(false);
                    }
                    that._allItems = (data && data.value) ? data.value : [];
                    that._computeStats(that._allItems);
                    that._applyFilters();
                })
                .catch(function (error) {
                    if (oTable) {
                        oTable.setBusy(false);
                    }
                    console.error("[TestResults] Error fetching records:", error);
                    MessageBox.error("Failed to fetch test records: " + error.message);
                });
        },

        /**
         * Calculate KPI metrics
         */
        _computeStats: function (aItems) {
            var nTotal = aItems.length;
            var nPassed = 0;
            var nFailed = 0;

            aItems.forEach(function (item) {
                if (item.outcome === "Success") {
                    nPassed++;
                } else if (item.outcome === "Failure") {
                    nFailed++;
                }
            });

            var nRate = nTotal > 0 ? Math.round((nPassed / nTotal) * 100) : 100;

            this._oStatsModel.setData({
                totalTests: nTotal,
                successRate: nRate,
                passedCount: nPassed,
                failedCount: nFailed
            });
        },

        /**
         * Search filter: Filters across sourceText, translatedText, and testedBy
         */
        onSearchLiveChange: function () {
            this._applyFilters();
        },

        /**
         * Outcome filter dropdown change
         */
        onOutcomeFilterChange: function () {
            this._applyFilters();
        },

        /**
         * Apply both search query and outcome filter
         */
        _applyFilters: function () {
            var sQuery = (this.byId("searchField").getValue() || "").toLowerCase().trim();
            var sOutcomeFilter = this.byId("outcomeFilterSelect").getSelectedKey();

            var aFiltered = this._allItems.filter(function (item) {
                // Outcome filter match
                var bMatchesOutcome = true;
                if (sOutcomeFilter && sOutcomeFilter !== "ALL") {
                    bMatchesOutcome = (item.outcome === sOutcomeFilter);
                }

                if (!bMatchesOutcome) {
                    return false;
                }

                // Search query match
                if (!sQuery) {
                    return true;
                }

                var sSource = (item.textToTranslate || "").toLowerCase();
                var sTrans = (item.translatedText || "").toLowerCase();
                var sTester = (item.testedBy || "").toLowerCase();
                var sLang = (item.targetLanguage || "").toLowerCase();

                return sSource.indexOf(sQuery) !== -1 ||
                       sTrans.indexOf(sQuery) !== -1 ||
                       sTester.indexOf(sQuery) !== -1 ||
                       sLang.indexOf(sQuery) !== -1;
            });

            this._oResultsModel.setProperty("/items", aFiltered);
            this.byId("tableTitle").setText("Test Records (" + aFiltered.length + ")");
        },

        /**
         * UI formatters
         */
        formatOutcomeState: function (sOutcome) {
            switch (sOutcome) {
                case "Success":
                    return "Success";
                case "Partial":
                    return "Warning";
                case "Failure":
                    return "Error";
                default:
                    return "None";
            }
        },

        formatAccuracyText: function (nAccuracy) {
            if (nAccuracy === null || nAccuracy === undefined || nAccuracy === "") {
                return "N/A";
            }
            return nAccuracy + "%";
        },

        formatAccuracyState: function (nAccuracy) {
            if (nAccuracy === null || nAccuracy === undefined || nAccuracy === "") {
                return "None";
            }
            if (nAccuracy >= 80) {
                return "Success";
            }
            if (nAccuracy >= 50) {
                return "Warning";
            }
            return "Error";
        },

        formatDate: function (sDate) {
            if (!sDate) {
                return "";
            }
            try {
                var d = new Date(sDate);
                return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            } catch (e) {
                return sDate;
            }
        },

        /**
         * Export current test results to Excel
         */
        onExportExcel: function () {
            var sOutcome = this.byId("outcomeFilterSelect").getSelectedKey();
            var sUrl = this.getApiUrl("/api/export-results-excel");
            if (sOutcome && sOutcome !== "ALL") {
                sUrl += "?outcome=" + encodeURIComponent(sOutcome);
            }
            var oLink = document.createElement("a");
            oLink.href = sUrl;
            oLink.download = "PLM_Test_Results.xlsx";
            document.body.appendChild(oLink);
            oLink.click();
            document.body.removeChild(oLink);
            MessageToast.show("Exporting test results to Excel...");
        },

        /**
         * View Details in a Dialog
         */
        onViewDetails: function (oEvent) {
            var oCtx = oEvent.getSource().getBindingContext("resultsModel");
            var oData = oCtx.getObject();

            var oDialog = new Dialog({
                title: "Test Case Detail",
                contentWidth: "550px",
                content: [
                    new VBox({
                        class: "sapUiSmallMargin",
                        items: [
                            new Label({ text: "Outcome & Accuracy:", design: "Bold" }),
                            new Text({ text: oData.outcome + (oData.accuracy !== null && oData.accuracy !== undefined && oData.accuracy !== "" ? " (" + oData.accuracy + "%)" : " (N/A)") }),

                            new Label({ text: "Target Language:", design: "Bold", class: "sapUiSmallMarginTop" }),
                            new Text({ text: oData.targetLanguage || "N/A" }),

                            new Label({ text: "Tested By & Date:", design: "Bold", class: "sapUiSmallMarginTop" }),
                            new Text({ text: (oData.testedBy || "N/A") + " on " + this.formatDate(oData.createdAt) }),

                            new Label({ text: "Original Source Text:", design: "Bold", class: "sapUiSmallMarginTop" }),
                            new TextArea({ value: oData.textToTranslate, rows: 4, width: "100%", editable: false }),

                            new Label({ text: "Translated Text Output:", design: "Bold", class: "sapUiSmallMarginTop" }),
                            new TextArea({ value: oData.translatedText, rows: 4, width: "100%", editable: false }),

                            new Label({ text: "Observations / Feedback:", design: "Bold", class: "sapUiSmallMarginTop" }),
                            new Text({ text: oData.observation || "No specific observations recorded." })
                        ]
                    })
                ],
                beginButton: new Button({
                    text: "Close",
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                }
            });

            oDialog.open();
        },

        /**
         * Delete Record via OData DELETE /api/TestResults(ID)
         */
        onDeleteRecord: function (oEvent) {
            var oCtx = oEvent.getSource().getBindingContext("resultsModel");
            var oData = oCtx.getObject();
            var that = this;

            MessageBox.confirm("Are you sure you want to delete this test result?", {
                title: "Confirm Deletion",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        fetch(that.getApiUrl("/api/TestResults(" + oData.ID + ")"), {
                            method: "DELETE"
                        })
                        .then(function (response) {
                            if (response.ok || response.status === 204) {
                                MessageToast.show("Test result deleted");
                                that._loadData();
                            } else {
                                throw new Error("HTTP error " + response.status);
                            }
                        })
                        .catch(function (error) {
                            MessageBox.error("Failed to delete record: " + error.message);
                        });
                    }
                }
            });
        }
    });
});

    },
    "plm/translator/app/controller/Translator.controller.js": function () {
// =============================================================
// PLM Translator - Single Translation Controller
// =============================================================
// Handles user interactions for single text translation:
// 1. Invoking CAP OData Action: /api/translate
// 2. Persisting test evaluation to CAP OData Entity: /api/TestResults
// 3. Clipboard copy, character counting, and validation
// Compatible with SAP Build Work Zone and CIS user context.
// =============================================================

sap.ui.define("plm/translator/app/controller/Translator.controller", [
    "plm/translator/app/controller/BaseController",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (BaseController, MessageToast, MessageBox) {
    "use strict";

    return BaseController.extend("plm.translator.app.controller.Translator", {

        onInit: function () {
            // Local state for current active translation
            this._currentTranslation = null;
        },

        /**
         * Update source character count as user types
         */
        onSourceTextLiveChange: function (oEvent) {
            var sText = oEvent.getParameter("value") || "";
            var oCharCount = this.byId("charCountText");
            if (oCharCount) {
                oCharCount.setText(sText.length + " characters");
            }
        },

        /**
         * Clear text area and reset translated output
         */
        onClearText: function () {
            this.byId("sourceTextArea").setValue("");
            this.byId("translatedTextArea").setValue("");
            this.byId("charCountText").setText("0 characters");
            this.byId("translatedCharCountText").setText("0 characters");
            this.byId("btnCopy").setEnabled(false);
            this.byId("btnSaveResult").setEnabled(false);
            this.byId("detectedLanguageStatus").setText("Ready").setState("None");
            this.byId("translationStatusText").setText("");
            this._currentTranslation = null;
        },

        /**
         * Slider live change to update percentage text
         */
        onAccuracySliderChange: function (oEvent) {
            var nVal = oEvent.getParameter("value");
            this.byId("accuracyValueText").setText(nVal + "%");
        },

        /**
         * Trigger translation via CAP OData Action /api/translate
         */
        onTranslate: function () {
            var sText = this.byId("sourceTextArea").getValue();
            var sTargetLang = this.byId("targetLanguageSelect").getSelectedKey();

            if (!sText || !sText.trim()) {
                MessageBox.warning("Please enter some text to translate.");
                return;
            }

            if (!sTargetLang) {
                MessageBox.warning("Please select a target language.");
                return;
            }

            var oStatus = this.byId("detectedLanguageStatus");
            var oBtnTranslate = this.byId("btnTranslate");
            var oTranslatedArea = this.byId("translatedTextArea");
            var that = this;

            oStatus.setText("Translating...").setState("Information");
            oBtnTranslate.setBusy(true);

            // Call CAP OData action /api/translate (Launchpad-safe)
            fetch(this.getApiUrl("/api/translate"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    text: sText.trim(),
                    targetLanguage: sTargetLang
                })
            })
            .then(function (response) {
                return response.json();
            })
            .then(function (result) {
                oBtnTranslate.setBusy(false);

                if (result.success) {
                    oTranslatedArea.setValue(result.translatedText || "");
                    that.byId("translatedCharCountText").setText((result.translatedText || "").length + " characters");
                    oStatus.setText("Detected: " + (result.sourceLanguage || "auto").toUpperCase()).setState("Success");
                    that.byId("btnCopy").setEnabled(true);
                    that.byId("btnSaveResult").setEnabled(true);

                    // Cache translation details for saving evaluation
                    that._currentTranslation = {
                        sourceText: sText.trim(),
                        translatedText: result.translatedText || "",
                        sourceLanguage: result.sourceLanguage || "auto",
                        targetLanguage: result.targetLanguage || sTargetLang
                    };

                    MessageToast.show("Translation completed successfully");
                } else {
                    oStatus.setText("Failed").setState("Error");
                    MessageBox.error("Translation error: " + (result.error || "Unknown error"));
                }
            })
            .catch(function (error) {
                oBtnTranslate.setBusy(false);
                oStatus.setText("Error").setState("Error");
                MessageBox.error("Failed to connect to translation service: " + error.message);
            });
        },

        /**
         * Copy translated text to user's clipboard
         */
        onCopyTranslation: function () {
            var sText = this.byId("translatedTextArea").getValue();
            if (!sText) {
                return;
            }

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(sText).then(function () {
                    MessageToast.show("Translated text copied to clipboard!");
                }).catch(function (err) {
                    MessageToast.show("Could not copy: " + err);
                });
            } else {
                // Fallback for older browsers
                var textArea = document.createElement("textarea");
                textArea.value = sText;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand("copy");
                document.body.removeChild(textArea);
                MessageToast.show("Translated text copied to clipboard!");
            }
        },

        /**
         * Save evaluation to database using standard CAP OData POST to /api/TestResults
         */
        onSaveTestResult: function () {
            if (!this._currentTranslation) {
                MessageBox.warning("Please translate some text first before saving a result.");
                return;
            }

            var nOutcomeIdx = this.byId("outcomeRadioGroup").getSelectedIndex();
            var aOutcomes = ["Success", "Partial", "Failure"];
            var sOutcome = aOutcomes[nOutcomeIdx] || "Success";

            var nAccuracy = this.byId("accuracySlider").getValue();
            var sTestedBy = this.byId("testedByInput").getValue();
            var sObservation = this.byId("observationInput").getValue();

            if (!sTestedBy || !sTestedBy.trim()) {
                MessageBox.warning("Please enter tester name.");
                return;
            }

            var oPayload = {
                outcome: sOutcome,
                accuracy: parseFloat(nAccuracy),
                observation: (sObservation || "").trim(),
                testedBy: sTestedBy.trim(),
                textToTranslate: this._currentTranslation.sourceText,
                translatedText: this._currentTranslation.translatedText,
                sourceLanguage: this._currentTranslation.sourceLanguage,
                targetLanguage: this._currentTranslation.targetLanguage
            };

            var oBtnSave = this.byId("btnSaveResult");
            oBtnSave.setBusy(true);

            fetch(this.getApiUrl("/api/TestResults"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(oPayload)
            })
            .then(function (response) {
                oBtnSave.setBusy(false);
                if (response.ok || response.status === 201) {
                    MessageToast.show("Test evaluation saved to database!");
                } else {
                    return response.json().then(function (err) {
                        throw new Error(err.error && err.error.message ? err.error.message : "Error saving");
                    });
                }
            })
            .catch(function (error) {
                oBtnSave.setBusy(false);
                MessageBox.error("Failed to save test result: " + error.message);
            });
        }
    });
});

    },
    "plm/translator/app/manifest.json": "{\r\n    \"_version\": \"1.65.0\",\r\n    \"sap.app\": {\r\n        \"id\": \"plm.translator.app\",\r\n        \"type\": \"application\",\r\n        \"title\": \"PLM Translator\",\r\n        \"description\": \"PLM Translation Tool powered by Google Cloud Translation API\",\r\n        \"applicationVersion\": {\r\n            \"version\": \"1.0.0\"\r\n        },\r\n        \"crossNavigation\": {\r\n            \"inbounds\": {\r\n                \"PLMTranslator-manage\": {\r\n                    \"semanticObject\": \"PLMTranslator\",\r\n                    \"action\": \"manage\",\r\n                    \"title\": \"PLM Translator\",\r\n                    \"subTitle\": \"Google Cloud Translation Tool\",\r\n                    \"icon\": \"sap-icon://translate\",\r\n                    \"signature\": {\r\n                        \"parameters\": {},\r\n                        \"additionalParameters\": \"allowed\"\r\n                    }\r\n                }\r\n            }\r\n        },\r\n        \"dataSources\": {\r\n            \"translatorService\": {\r\n                \"uri\": \"api/\",\r\n                \"type\": \"OData\",\r\n                \"settings\": {\r\n                    \"odataVersion\": \"4.0\"\r\n                }\r\n            }\r\n        }\r\n    },\r\n    \"sap.cloud\": {\r\n        \"public\": true,\r\n        \"service\": \"plmtranslator\"\r\n    },\r\n    \"sap.ui5\": {\r\n        \"rootView\": {\r\n            \"viewName\": \"plm.translator.app.view.App\",\r\n            \"type\": \"XML\",\n            \"async\": true\r\r\n        },\r\n        \"models\": {\r\n            \"\": {\r\n                \"dataSource\": \"translatorService\",\r\n                \"settings\": {\r\n                    \"operationMode\": \"Server\",\r\n                    \"synchronizationMode\": \"None\",\r\n                    \"autoExpandSelect\": true\r\n                }\r\n            },\r\n            \"appModel\": {\r\n                \"type\": \"sap.ui.model.json.JSONModel\",\r\n                \"settings\": {\r\n                    \"data\": {\r\n                        \"languages\": [],\r\n                        \"translationResult\": null,\r\n                        \"busy\": false,\r\n                        \"massTranslationResult\": null,\r\n                        \"userInfo\": {}\r\n                    }\r\n                }\r\n            }\r\n        },\r\n        \"routing\": {\r\n            \"config\": {\r\n                \"routerClass\": \"sap.m.routing.Router\",\r\n                \"viewType\": \"XML\",\r\n                \"viewPath\": \"plm.translator.app.view\",\r\n                \"controlId\": \"appContainer\",\r\n                \"controlAggregation\": \"pages\",\r\n                \"async\": true\r\n            },\r\n            \"routes\": [\r\n                {\r\n                    \"name\": \"translator\",\r\n                    \"pattern\": \"\",\r\n                    \"target\": \"translator\"\r\n                },\r\n                {\r\n                    \"name\": \"massTranslation\",\r\n                    \"pattern\": \"mass-translation\",\r\n                    \"target\": \"massTranslation\"\r\n                },\r\n                {\r\n                    \"name\": \"testResults\",\r\n                    \"pattern\": \"test-results\",\r\n                    \"target\": \"testResults\"\r\n                }\r\n            ],\r\n            \"targets\": {\r\n                \"translator\": {\r\n                    \"viewName\": \"Translator\",\r\n                    \"viewLevel\": 1\r\n                },\r\n                \"massTranslation\": {\r\n                    \"viewName\": \"MassTranslation\",\r\n                    \"viewLevel\": 2\r\n                },\r\n                \"testResults\": {\r\n                    \"viewName\": \"TestResults\",\r\n                    \"viewLevel\": 3\r\n                }\r\n            }\r\n        },\r\n        \"dependencies\": {\r\n            \"minUI5Version\": \"1.120.0\",\r\n            \"libs\": {\r\n                \"sap.m\": {},\r\n                \"sap.ui.core\": {},\r\n                \"sap.ui.layout\": {},\r\n                \"sap.ui.unified\": {},\r\n                \"sap.ui.table\": {}\r\n            }\r\n        }\r\n    }\r\n}\r\n",
    "plm/translator/app/model/languages.json": "[\r\n  {\r\n    \"key\": \"ab\",\r\n    \"code\": \"ab\",\r\n    \"name\": \"Abkhaz\",\r\n    \"text\": \"Abkhaz (ab)\"\r\n  },\r\n  {\r\n    \"key\": \"ace\",\r\n    \"code\": \"ace\",\r\n    \"name\": \"Acehnese\",\r\n    \"text\": \"Acehnese (ace)\"\r\n  },\r\n  {\r\n    \"key\": \"ach\",\r\n    \"code\": \"ach\",\r\n    \"name\": \"Acholi\",\r\n    \"text\": \"Acholi (ach)\"\r\n  },\r\n  {\r\n    \"key\": \"af\",\r\n    \"code\": \"af\",\r\n    \"name\": \"Afrikaans\",\r\n    \"text\": \"Afrikaans (af)\"\r\n  },\r\n  {\r\n    \"key\": \"sq\",\r\n    \"code\": \"sq\",\r\n    \"name\": \"Albanian\",\r\n    \"text\": \"Albanian (sq)\"\r\n  },\r\n  {\r\n    \"key\": \"alz\",\r\n    \"code\": \"alz\",\r\n    \"name\": \"Alur\",\r\n    \"text\": \"Alur (alz)\"\r\n  },\r\n  {\r\n    \"key\": \"am\",\r\n    \"code\": \"am\",\r\n    \"name\": \"Amharic\",\r\n    \"text\": \"Amharic (am)\"\r\n  },\r\n  {\r\n    \"key\": \"ar\",\r\n    \"code\": \"ar\",\r\n    \"name\": \"Arabic\",\r\n    \"text\": \"Arabic (ar)\"\r\n  },\r\n  {\r\n    \"key\": \"hy\",\r\n    \"code\": \"hy\",\r\n    \"name\": \"Armenian\",\r\n    \"text\": \"Armenian (hy)\"\r\n  },\r\n  {\r\n    \"key\": \"as\",\r\n    \"code\": \"as\",\r\n    \"name\": \"Assamese\",\r\n    \"text\": \"Assamese (as)\"\r\n  },\r\n  {\r\n    \"key\": \"awa\",\r\n    \"code\": \"awa\",\r\n    \"name\": \"Awadhi\",\r\n    \"text\": \"Awadhi (awa)\"\r\n  },\r\n  {\r\n    \"key\": \"ay\",\r\n    \"code\": \"ay\",\r\n    \"name\": \"Aymara\",\r\n    \"text\": \"Aymara (ay)\"\r\n  },\r\n  {\r\n    \"key\": \"az\",\r\n    \"code\": \"az\",\r\n    \"name\": \"Azerbaijani\",\r\n    \"text\": \"Azerbaijani (az)\"\r\n  },\r\n  {\r\n    \"key\": \"ban\",\r\n    \"code\": \"ban\",\r\n    \"name\": \"Balinese\",\r\n    \"text\": \"Balinese (ban)\"\r\n  },\r\n  {\r\n    \"key\": \"bm\",\r\n    \"code\": \"bm\",\r\n    \"name\": \"Bambara\",\r\n    \"text\": \"Bambara (bm)\"\r\n  },\r\n  {\r\n    \"key\": \"ba\",\r\n    \"code\": \"ba\",\r\n    \"name\": \"Bashkir\",\r\n    \"text\": \"Bashkir (ba)\"\r\n  },\r\n  {\r\n    \"key\": \"eu\",\r\n    \"code\": \"eu\",\r\n    \"name\": \"Basque\",\r\n    \"text\": \"Basque (eu)\"\r\n  },\r\n  {\r\n    \"key\": \"btx\",\r\n    \"code\": \"btx\",\r\n    \"name\": \"Batak Karo\",\r\n    \"text\": \"Batak Karo (btx)\"\r\n  },\r\n  {\r\n    \"key\": \"bts\",\r\n    \"code\": \"bts\",\r\n    \"name\": \"Batak Simalungun\",\r\n    \"text\": \"Batak Simalungun (bts)\"\r\n  },\r\n  {\r\n    \"key\": \"bbc\",\r\n    \"code\": \"bbc\",\r\n    \"name\": \"Batak Toba\",\r\n    \"text\": \"Batak Toba (bbc)\"\r\n  },\r\n  {\r\n    \"key\": \"be\",\r\n    \"code\": \"be\",\r\n    \"name\": \"Belarusian\",\r\n    \"text\": \"Belarusian (be)\"\r\n  },\r\n  {\r\n    \"key\": \"bem\",\r\n    \"code\": \"bem\",\r\n    \"name\": \"Bemba\",\r\n    \"text\": \"Bemba (bem)\"\r\n  },\r\n  {\r\n    \"key\": \"bn\",\r\n    \"code\": \"bn\",\r\n    \"name\": \"Bengali\",\r\n    \"text\": \"Bengali (bn)\"\r\n  },\r\n  {\r\n    \"key\": \"bew\",\r\n    \"code\": \"bew\",\r\n    \"name\": \"Betawi\",\r\n    \"text\": \"Betawi (bew)\"\r\n  },\r\n  {\r\n    \"key\": \"bho\",\r\n    \"code\": \"bho\",\r\n    \"name\": \"Bhojpuri\",\r\n    \"text\": \"Bhojpuri (bho)\"\r\n  },\r\n  {\r\n    \"key\": \"bik\",\r\n    \"code\": \"bik\",\r\n    \"name\": \"Bikol\",\r\n    \"text\": \"Bikol (bik)\"\r\n  },\r\n  {\r\n    \"key\": \"bs\",\r\n    \"code\": \"bs\",\r\n    \"name\": \"Bosnian\",\r\n    \"text\": \"Bosnian (bs)\"\r\n  },\r\n  {\r\n    \"key\": \"br\",\r\n    \"code\": \"br\",\r\n    \"name\": \"Breton\",\r\n    \"text\": \"Breton (br)\"\r\n  },\r\n  {\r\n    \"key\": \"bg\",\r\n    \"code\": \"bg\",\r\n    \"name\": \"Bulgarian\",\r\n    \"text\": \"Bulgarian (bg)\"\r\n  },\r\n  {\r\n    \"key\": \"bua\",\r\n    \"code\": \"bua\",\r\n    \"name\": \"Buryat\",\r\n    \"text\": \"Buryat (bua)\"\r\n  },\r\n  {\r\n    \"key\": \"yue\",\r\n    \"code\": \"yue\",\r\n    \"name\": \"Cantonese\",\r\n    \"text\": \"Cantonese (yue)\"\r\n  },\r\n  {\r\n    \"key\": \"ca\",\r\n    \"code\": \"ca\",\r\n    \"name\": \"Catalan\",\r\n    \"text\": \"Catalan (ca)\"\r\n  },\r\n  {\r\n    \"key\": \"ceb\",\r\n    \"code\": \"ceb\",\r\n    \"name\": \"Cebuano\",\r\n    \"text\": \"Cebuano (ceb)\"\r\n  },\r\n  {\r\n    \"key\": \"ny\",\r\n    \"code\": \"ny\",\r\n    \"name\": \"Chichewa\",\r\n    \"text\": \"Chichewa (ny)\"\r\n  },\r\n  {\r\n    \"key\": \"zh\",\r\n    \"code\": \"zh\",\r\n    \"name\": \"Chinese (Simplified)\",\r\n    \"text\": \"Chinese (Simplified) (zh)\"\r\n  },\r\n  {\r\n    \"key\": \"zh-CN\",\r\n    \"code\": \"zh-CN\",\r\n    \"name\": \"Chinese (Simplified)\",\r\n    \"text\": \"Chinese (Simplified) (zh-CN)\"\r\n  },\r\n  {\r\n    \"key\": \"zh-TW\",\r\n    \"code\": \"zh-TW\",\r\n    \"name\": \"Chinese (Traditional)\",\r\n    \"text\": \"Chinese (Traditional) (zh-TW)\"\r\n  },\r\n  {\r\n    \"key\": \"cv\",\r\n    \"code\": \"cv\",\r\n    \"name\": \"Chuvash\",\r\n    \"text\": \"Chuvash (cv)\"\r\n  },\r\n  {\r\n    \"key\": \"co\",\r\n    \"code\": \"co\",\r\n    \"name\": \"Corsican\",\r\n    \"text\": \"Corsican (co)\"\r\n  },\r\n  {\r\n    \"key\": \"crh\",\r\n    \"code\": \"crh\",\r\n    \"name\": \"Crimean Tatar\",\r\n    \"text\": \"Crimean Tatar (crh)\"\r\n  },\r\n  {\r\n    \"key\": \"hr\",\r\n    \"code\": \"hr\",\r\n    \"name\": \"Croatian\",\r\n    \"text\": \"Croatian (hr)\"\r\n  },\r\n  {\r\n    \"key\": \"cs\",\r\n    \"code\": \"cs\",\r\n    \"name\": \"Czech\",\r\n    \"text\": \"Czech (cs)\"\r\n  },\r\n  {\r\n    \"key\": \"da\",\r\n    \"code\": \"da\",\r\n    \"name\": \"Danish\",\r\n    \"text\": \"Danish (da)\"\r\n  },\r\n  {\r\n    \"key\": \"dv\",\r\n    \"code\": \"dv\",\r\n    \"name\": \"Dhivehi\",\r\n    \"text\": \"Dhivehi (dv)\"\r\n  },\r\n  {\r\n    \"key\": \"din\",\r\n    \"code\": \"din\",\r\n    \"name\": \"Dinka\",\r\n    \"text\": \"Dinka (din)\"\r\n  },\r\n  {\r\n    \"key\": \"doi\",\r\n    \"code\": \"doi\",\r\n    \"name\": \"Dogri\",\r\n    \"text\": \"Dogri (doi)\"\r\n  },\r\n  {\r\n    \"key\": \"dov\",\r\n    \"code\": \"dov\",\r\n    \"name\": \"Dombe\",\r\n    \"text\": \"Dombe (dov)\"\r\n  },\r\n  {\r\n    \"key\": \"nl\",\r\n    \"code\": \"nl\",\r\n    \"name\": \"Dutch\",\r\n    \"text\": \"Dutch (nl)\"\r\n  },\r\n  {\r\n    \"key\": \"dz\",\r\n    \"code\": \"dz\",\r\n    \"name\": \"Dzongkha\",\r\n    \"text\": \"Dzongkha (dz)\"\r\n  },\r\n  {\r\n    \"key\": \"en\",\r\n    \"code\": \"en\",\r\n    \"name\": \"English\",\r\n    \"text\": \"English (en)\"\r\n  },\r\n  {\r\n    \"key\": \"eo\",\r\n    \"code\": \"eo\",\r\n    \"name\": \"Esperanto\",\r\n    \"text\": \"Esperanto (eo)\"\r\n  },\r\n  {\r\n    \"key\": \"et\",\r\n    \"code\": \"et\",\r\n    \"name\": \"Estonian\",\r\n    \"text\": \"Estonian (et)\"\r\n  },\r\n  {\r\n    \"key\": \"ee\",\r\n    \"code\": \"ee\",\r\n    \"name\": \"Ewe\",\r\n    \"text\": \"Ewe (ee)\"\r\n  },\r\n  {\r\n    \"key\": \"fj\",\r\n    \"code\": \"fj\",\r\n    \"name\": \"Fijian\",\r\n    \"text\": \"Fijian (fj)\"\r\n  },\r\n  {\r\n    \"key\": \"tl\",\r\n    \"code\": \"tl\",\r\n    \"name\": \"Filipino\",\r\n    \"text\": \"Filipino (tl)\"\r\n  },\r\n  {\r\n    \"key\": \"fi\",\r\n    \"code\": \"fi\",\r\n    \"name\": \"Finnish\",\r\n    \"text\": \"Finnish (fi)\"\r\n  },\r\n  {\r\n    \"key\": \"fr\",\r\n    \"code\": \"fr\",\r\n    \"name\": \"French\",\r\n    \"text\": \"French (fr)\"\r\n  },\r\n  {\r\n    \"key\": \"fr-CA\",\r\n    \"code\": \"fr-CA\",\r\n    \"name\": \"French (Canada)\",\r\n    \"text\": \"French (Canada) (fr-CA)\"\r\n  },\r\n  {\r\n    \"key\": \"fy\",\r\n    \"code\": \"fy\",\r\n    \"name\": \"Frisian\",\r\n    \"text\": \"Frisian (fy)\"\r\n  },\r\n  {\r\n    \"key\": \"ff\",\r\n    \"code\": \"ff\",\r\n    \"name\": \"Fulani\",\r\n    \"text\": \"Fulani (ff)\"\r\n  },\r\n  {\r\n    \"key\": \"gaa\",\r\n    \"code\": \"gaa\",\r\n    \"name\": \"Ga\",\r\n    \"text\": \"Ga (gaa)\"\r\n  },\r\n  {\r\n    \"key\": \"gl\",\r\n    \"code\": \"gl\",\r\n    \"name\": \"Galician\",\r\n    \"text\": \"Galician (gl)\"\r\n  },\r\n  {\r\n    \"key\": \"ka\",\r\n    \"code\": \"ka\",\r\n    \"name\": \"Georgian\",\r\n    \"text\": \"Georgian (ka)\"\r\n  },\r\n  {\r\n    \"key\": \"de\",\r\n    \"code\": \"de\",\r\n    \"name\": \"German\",\r\n    \"text\": \"German (de)\"\r\n  },\r\n  {\r\n    \"key\": \"el\",\r\n    \"code\": \"el\",\r\n    \"name\": \"Greek\",\r\n    \"text\": \"Greek (el)\"\r\n  },\r\n  {\r\n    \"key\": \"gn\",\r\n    \"code\": \"gn\",\r\n    \"name\": \"Guarani\",\r\n    \"text\": \"Guarani (gn)\"\r\n  },\r\n  {\r\n    \"key\": \"gu\",\r\n    \"code\": \"gu\",\r\n    \"name\": \"Gujarati\",\r\n    \"text\": \"Gujarati (gu)\"\r\n  },\r\n  {\r\n    \"key\": \"ht\",\r\n    \"code\": \"ht\",\r\n    \"name\": \"Haitian Creole\",\r\n    \"text\": \"Haitian Creole (ht)\"\r\n  },\r\n  {\r\n    \"key\": \"cnh\",\r\n    \"code\": \"cnh\",\r\n    \"name\": \"Hakha Chin\",\r\n    \"text\": \"Hakha Chin (cnh)\"\r\n  },\r\n  {\r\n    \"key\": \"ha\",\r\n    \"code\": \"ha\",\r\n    \"name\": \"Hausa\",\r\n    \"text\": \"Hausa (ha)\"\r\n  },\r\n  {\r\n    \"key\": \"haw\",\r\n    \"code\": \"haw\",\r\n    \"name\": \"Hawaiian\",\r\n    \"text\": \"Hawaiian (haw)\"\r\n  },\r\n  {\r\n    \"key\": \"iw\",\r\n    \"code\": \"iw\",\r\n    \"name\": \"Hebrew\",\r\n    \"text\": \"Hebrew (iw)\"\r\n  },\r\n  {\r\n    \"key\": \"he\",\r\n    \"code\": \"he\",\r\n    \"name\": \"Hebrew\",\r\n    \"text\": \"Hebrew (he)\"\r\n  },\r\n  {\r\n    \"key\": \"hil\",\r\n    \"code\": \"hil\",\r\n    \"name\": \"Hiligaynon\",\r\n    \"text\": \"Hiligaynon (hil)\"\r\n  },\r\n  {\r\n    \"key\": \"hi\",\r\n    \"code\": \"hi\",\r\n    \"name\": \"Hindi\",\r\n    \"text\": \"Hindi (hi)\"\r\n  },\r\n  {\r\n    \"key\": \"hmn\",\r\n    \"code\": \"hmn\",\r\n    \"name\": \"Hmong\",\r\n    \"text\": \"Hmong (hmn)\"\r\n  },\r\n  {\r\n    \"key\": \"hu\",\r\n    \"code\": \"hu\",\r\n    \"name\": \"Hungarian\",\r\n    \"text\": \"Hungarian (hu)\"\r\n  },\r\n  {\r\n    \"key\": \"hrx\",\r\n    \"code\": \"hrx\",\r\n    \"name\": \"Hunsrik\",\r\n    \"text\": \"Hunsrik (hrx)\"\r\n  },\r\n  {\r\n    \"key\": \"is\",\r\n    \"code\": \"is\",\r\n    \"name\": \"Icelandic\",\r\n    \"text\": \"Icelandic (is)\"\r\n  },\r\n  {\r\n    \"key\": \"ig\",\r\n    \"code\": \"ig\",\r\n    \"name\": \"Igbo\",\r\n    \"text\": \"Igbo (ig)\"\r\n  },\r\n  {\r\n    \"key\": \"ilo\",\r\n    \"code\": \"ilo\",\r\n    \"name\": \"Ilocano\",\r\n    \"text\": \"Ilocano (ilo)\"\r\n  },\r\n  {\r\n    \"key\": \"id\",\r\n    \"code\": \"id\",\r\n    \"name\": \"Indonesian\",\r\n    \"text\": \"Indonesian (id)\"\r\n  },\r\n  {\r\n    \"key\": \"ga\",\r\n    \"code\": \"ga\",\r\n    \"name\": \"Irish\",\r\n    \"text\": \"Irish (ga)\"\r\n  },\r\n  {\r\n    \"key\": \"it\",\r\n    \"code\": \"it\",\r\n    \"name\": \"Italian\",\r\n    \"text\": \"Italian (it)\"\r\n  },\r\n  {\r\n    \"key\": \"ja\",\r\n    \"code\": \"ja\",\r\n    \"name\": \"Japanese\",\r\n    \"text\": \"Japanese (ja)\"\r\n  },\r\n  {\r\n    \"key\": \"jw\",\r\n    \"code\": \"jw\",\r\n    \"name\": \"Javanese\",\r\n    \"text\": \"Javanese (jw)\"\r\n  },\r\n  {\r\n    \"key\": \"jv\",\r\n    \"code\": \"jv\",\r\n    \"name\": \"Javanese\",\r\n    \"text\": \"Javanese (jv)\"\r\n  },\r\n  {\r\n    \"key\": \"kn\",\r\n    \"code\": \"kn\",\r\n    \"name\": \"Kannada\",\r\n    \"text\": \"Kannada (kn)\"\r\n  },\r\n  {\r\n    \"key\": \"pam\",\r\n    \"code\": \"pam\",\r\n    \"name\": \"Kapampangan\",\r\n    \"text\": \"Kapampangan (pam)\"\r\n  },\r\n  {\r\n    \"key\": \"kk\",\r\n    \"code\": \"kk\",\r\n    \"name\": \"Kazakh\",\r\n    \"text\": \"Kazakh (kk)\"\r\n  },\r\n  {\r\n    \"key\": \"km\",\r\n    \"code\": \"km\",\r\n    \"name\": \"Khmer\",\r\n    \"text\": \"Khmer (km)\"\r\n  },\r\n  {\r\n    \"key\": \"cgg\",\r\n    \"code\": \"cgg\",\r\n    \"name\": \"Kiga\",\r\n    \"text\": \"Kiga (cgg)\"\r\n  },\r\n  {\r\n    \"key\": \"rw\",\r\n    \"code\": \"rw\",\r\n    \"name\": \"Kinyarwanda\",\r\n    \"text\": \"Kinyarwanda (rw)\"\r\n  },\r\n  {\r\n    \"key\": \"ktu\",\r\n    \"code\": \"ktu\",\r\n    \"name\": \"Kituba\",\r\n    \"text\": \"Kituba (ktu)\"\r\n  },\r\n  {\r\n    \"key\": \"gom\",\r\n    \"code\": \"gom\",\r\n    \"name\": \"Konkani\",\r\n    \"text\": \"Konkani (gom)\"\r\n  },\r\n  {\r\n    \"key\": \"ko\",\r\n    \"code\": \"ko\",\r\n    \"name\": \"Korean\",\r\n    \"text\": \"Korean (ko)\"\r\n  },\r\n  {\r\n    \"key\": \"kri\",\r\n    \"code\": \"kri\",\r\n    \"name\": \"Krio\",\r\n    \"text\": \"Krio (kri)\"\r\n  },\r\n  {\r\n    \"key\": \"ku\",\r\n    \"code\": \"ku\",\r\n    \"name\": \"Kurdish (Kurmanji)\",\r\n    \"text\": \"Kurdish (Kurmanji) (ku)\"\r\n  },\r\n  {\r\n    \"key\": \"ckb\",\r\n    \"code\": \"ckb\",\r\n    \"name\": \"Kurdish (Sorani)\",\r\n    \"text\": \"Kurdish (Sorani) (ckb)\"\r\n  },\r\n  {\r\n    \"key\": \"ky\",\r\n    \"code\": \"ky\",\r\n    \"name\": \"Kyrgyz\",\r\n    \"text\": \"Kyrgyz (ky)\"\r\n  },\r\n  {\r\n    \"key\": \"lo\",\r\n    \"code\": \"lo\",\r\n    \"name\": \"Lao\",\r\n    \"text\": \"Lao (lo)\"\r\n  },\r\n  {\r\n    \"key\": \"ltg\",\r\n    \"code\": \"ltg\",\r\n    \"name\": \"Latgalian\",\r\n    \"text\": \"Latgalian (ltg)\"\r\n  },\r\n  {\r\n    \"key\": \"la\",\r\n    \"code\": \"la\",\r\n    \"name\": \"Latin\",\r\n    \"text\": \"Latin (la)\"\r\n  },\r\n  {\r\n    \"key\": \"lv\",\r\n    \"code\": \"lv\",\r\n    \"name\": \"Latvian\",\r\n    \"text\": \"Latvian (lv)\"\r\n  },\r\n  {\r\n    \"key\": \"lij\",\r\n    \"code\": \"lij\",\r\n    \"name\": \"Ligurian\",\r\n    \"text\": \"Ligurian (lij)\"\r\n  },\r\n  {\r\n    \"key\": \"li\",\r\n    \"code\": \"li\",\r\n    \"name\": \"Limburgish\",\r\n    \"text\": \"Limburgish (li)\"\r\n  },\r\n  {\r\n    \"key\": \"ln\",\r\n    \"code\": \"ln\",\r\n    \"name\": \"Lingala\",\r\n    \"text\": \"Lingala (ln)\"\r\n  },\r\n  {\r\n    \"key\": \"lt\",\r\n    \"code\": \"lt\",\r\n    \"name\": \"Lithuanian\",\r\n    \"text\": \"Lithuanian (lt)\"\r\n  },\r\n  {\r\n    \"key\": \"lmo\",\r\n    \"code\": \"lmo\",\r\n    \"name\": \"Lombard\",\r\n    \"text\": \"Lombard (lmo)\"\r\n  },\r\n  {\r\n    \"key\": \"lg\",\r\n    \"code\": \"lg\",\r\n    \"name\": \"Luganda\",\r\n    \"text\": \"Luganda (lg)\"\r\n  },\r\n  {\r\n    \"key\": \"luo\",\r\n    \"code\": \"luo\",\r\n    \"name\": \"Luo\",\r\n    \"text\": \"Luo (luo)\"\r\n  },\r\n  {\r\n    \"key\": \"lb\",\r\n    \"code\": \"lb\",\r\n    \"name\": \"Luxembourgish\",\r\n    \"text\": \"Luxembourgish (lb)\"\r\n  },\r\n  {\r\n    \"key\": \"mk\",\r\n    \"code\": \"mk\",\r\n    \"name\": \"Macedonian\",\r\n    \"text\": \"Macedonian (mk)\"\r\n  },\r\n  {\r\n    \"key\": \"mai\",\r\n    \"code\": \"mai\",\r\n    \"name\": \"Maithili\",\r\n    \"text\": \"Maithili (mai)\"\r\n  },\r\n  {\r\n    \"key\": \"mak\",\r\n    \"code\": \"mak\",\r\n    \"name\": \"Makassar\",\r\n    \"text\": \"Makassar (mak)\"\r\n  },\r\n  {\r\n    \"key\": \"mg\",\r\n    \"code\": \"mg\",\r\n    \"name\": \"Malagasy\",\r\n    \"text\": \"Malagasy (mg)\"\r\n  },\r\n  {\r\n    \"key\": \"ms\",\r\n    \"code\": \"ms\",\r\n    \"name\": \"Malay\",\r\n    \"text\": \"Malay (ms)\"\r\n  },\r\n  {\r\n    \"key\": \"ms-Arab\",\r\n    \"code\": \"ms-Arab\",\r\n    \"name\": \"Malay (Jawi)\",\r\n    \"text\": \"Malay (Jawi) (ms-Arab)\"\r\n  },\r\n  {\r\n    \"key\": \"ml\",\r\n    \"code\": \"ml\",\r\n    \"name\": \"Malayalam\",\r\n    \"text\": \"Malayalam (ml)\"\r\n  },\r\n  {\r\n    \"key\": \"mt\",\r\n    \"code\": \"mt\",\r\n    \"name\": \"Maltese\",\r\n    \"text\": \"Maltese (mt)\"\r\n  },\r\n  {\r\n    \"key\": \"mi\",\r\n    \"code\": \"mi\",\r\n    \"name\": \"Maori\",\r\n    \"text\": \"Maori (mi)\"\r\n  },\r\n  {\r\n    \"key\": \"mr\",\r\n    \"code\": \"mr\",\r\n    \"name\": \"Marathi\",\r\n    \"text\": \"Marathi (mr)\"\r\n  },\r\n  {\r\n    \"key\": \"chm\",\r\n    \"code\": \"chm\",\r\n    \"name\": \"Meadow Mari\",\r\n    \"text\": \"Meadow Mari (chm)\"\r\n  },\r\n  {\r\n    \"key\": \"mni-Mtei\",\r\n    \"code\": \"mni-Mtei\",\r\n    \"name\": \"Meiteilon (Manipuri)\",\r\n    \"text\": \"Meiteilon (Manipuri) (mni-Mtei)\"\r\n  },\r\n  {\r\n    \"key\": \"min\",\r\n    \"code\": \"min\",\r\n    \"name\": \"Minang\",\r\n    \"text\": \"Minang (min)\"\r\n  },\r\n  {\r\n    \"key\": \"lus\",\r\n    \"code\": \"lus\",\r\n    \"name\": \"Mizo\",\r\n    \"text\": \"Mizo (lus)\"\r\n  },\r\n  {\r\n    \"key\": \"mn\",\r\n    \"code\": \"mn\",\r\n    \"name\": \"Mongolian\",\r\n    \"text\": \"Mongolian (mn)\"\r\n  },\r\n  {\r\n    \"key\": \"my\",\r\n    \"code\": \"my\",\r\n    \"name\": \"Myanmar (Burmese)\",\r\n    \"text\": \"Myanmar (Burmese) (my)\"\r\n  },\r\n  {\r\n    \"key\": \"nr\",\r\n    \"code\": \"nr\",\r\n    \"name\": \"Ndebele (South)\",\r\n    \"text\": \"Ndebele (South) (nr)\"\r\n  },\r\n  {\r\n    \"key\": \"new\",\r\n    \"code\": \"new\",\r\n    \"name\": \"Nepalbhasa (Newari)\",\r\n    \"text\": \"Nepalbhasa (Newari) (new)\"\r\n  },\r\n  {\r\n    \"key\": \"ne\",\r\n    \"code\": \"ne\",\r\n    \"name\": \"Nepali\",\r\n    \"text\": \"Nepali (ne)\"\r\n  },\r\n  {\r\n    \"key\": \"no\",\r\n    \"code\": \"no\",\r\n    \"name\": \"Norwegian\",\r\n    \"text\": \"Norwegian (no)\"\r\n  },\r\n  {\r\n    \"key\": \"nus\",\r\n    \"code\": \"nus\",\r\n    \"name\": \"Nuer\",\r\n    \"text\": \"Nuer (nus)\"\r\n  },\r\n  {\r\n    \"key\": \"oc\",\r\n    \"code\": \"oc\",\r\n    \"name\": \"Occitan\",\r\n    \"text\": \"Occitan (oc)\"\r\n  },\r\n  {\r\n    \"key\": \"or\",\r\n    \"code\": \"or\",\r\n    \"name\": \"Odia (Oriya)\",\r\n    \"text\": \"Odia (Oriya) (or)\"\r\n  },\r\n  {\r\n    \"key\": \"om\",\r\n    \"code\": \"om\",\r\n    \"name\": \"Oromo\",\r\n    \"text\": \"Oromo (om)\"\r\n  },\r\n  {\r\n    \"key\": \"pag\",\r\n    \"code\": \"pag\",\r\n    \"name\": \"Pangasinan\",\r\n    \"text\": \"Pangasinan (pag)\"\r\n  },\r\n  {\r\n    \"key\": \"pap\",\r\n    \"code\": \"pap\",\r\n    \"name\": \"Papiamento\",\r\n    \"text\": \"Papiamento (pap)\"\r\n  },\r\n  {\r\n    \"key\": \"ps\",\r\n    \"code\": \"ps\",\r\n    \"name\": \"Pashto\",\r\n    \"text\": \"Pashto (ps)\"\r\n  },\r\n  {\r\n    \"key\": \"fa\",\r\n    \"code\": \"fa\",\r\n    \"name\": \"Persian\",\r\n    \"text\": \"Persian (fa)\"\r\n  },\r\n  {\r\n    \"key\": \"pl\",\r\n    \"code\": \"pl\",\r\n    \"name\": \"Polish\",\r\n    \"text\": \"Polish (pl)\"\r\n  },\r\n  {\r\n    \"key\": \"pt\",\r\n    \"code\": \"pt\",\r\n    \"name\": \"Portuguese (Brazil)\",\r\n    \"text\": \"Portuguese (Brazil) (pt)\"\r\n  },\r\n  {\r\n    \"key\": \"pt-PT\",\r\n    \"code\": \"pt-PT\",\r\n    \"name\": \"Portuguese (Portugal)\",\r\n    \"text\": \"Portuguese (Portugal) (pt-PT)\"\r\n  },\r\n  {\r\n    \"key\": \"pa\",\r\n    \"code\": \"pa\",\r\n    \"name\": \"Punjabi (Gurmukhi)\",\r\n    \"text\": \"Punjabi (Gurmukhi) (pa)\"\r\n  },\r\n  {\r\n    \"key\": \"pa-Arab\",\r\n    \"code\": \"pa-Arab\",\r\n    \"name\": \"Punjabi (Shahmukhi)\",\r\n    \"text\": \"Punjabi (Shahmukhi) (pa-Arab)\"\r\n  },\r\n  {\r\n    \"key\": \"qu\",\r\n    \"code\": \"qu\",\r\n    \"name\": \"Quechua\",\r\n    \"text\": \"Quechua (qu)\"\r\n  },\r\n  {\r\n    \"key\": \"rom\",\r\n    \"code\": \"rom\",\r\n    \"name\": \"Romani\",\r\n    \"text\": \"Romani (rom)\"\r\n  },\r\n  {\r\n    \"key\": \"ro\",\r\n    \"code\": \"ro\",\r\n    \"name\": \"Romanian\",\r\n    \"text\": \"Romanian (ro)\"\r\n  },\r\n  {\r\n    \"key\": \"rn\",\r\n    \"code\": \"rn\",\r\n    \"name\": \"Rundi\",\r\n    \"text\": \"Rundi (rn)\"\r\n  },\r\n  {\r\n    \"key\": \"ru\",\r\n    \"code\": \"ru\",\r\n    \"name\": \"Russian\",\r\n    \"text\": \"Russian (ru)\"\r\n  },\r\n  {\r\n    \"key\": \"sm\",\r\n    \"code\": \"sm\",\r\n    \"name\": \"Samoan\",\r\n    \"text\": \"Samoan (sm)\"\r\n  },\r\n  {\r\n    \"key\": \"sg\",\r\n    \"code\": \"sg\",\r\n    \"name\": \"Sango\",\r\n    \"text\": \"Sango (sg)\"\r\n  },\r\n  {\r\n    \"key\": \"sa\",\r\n    \"code\": \"sa\",\r\n    \"name\": \"Sanskrit\",\r\n    \"text\": \"Sanskrit (sa)\"\r\n  },\r\n  {\r\n    \"key\": \"gd\",\r\n    \"code\": \"gd\",\r\n    \"name\": \"Scots Gaelic\",\r\n    \"text\": \"Scots Gaelic (gd)\"\r\n  },\r\n  {\r\n    \"key\": \"nso\",\r\n    \"code\": \"nso\",\r\n    \"name\": \"Sepedi\",\r\n    \"text\": \"Sepedi (nso)\"\r\n  },\r\n  {\r\n    \"key\": \"sr\",\r\n    \"code\": \"sr\",\r\n    \"name\": \"Serbian\",\r\n    \"text\": \"Serbian (sr)\"\r\n  },\r\n  {\r\n    \"key\": \"st\",\r\n    \"code\": \"st\",\r\n    \"name\": \"Sesotho\",\r\n    \"text\": \"Sesotho (st)\"\r\n  },\r\n  {\r\n    \"key\": \"crs\",\r\n    \"code\": \"crs\",\r\n    \"name\": \"Seychellois Creole\",\r\n    \"text\": \"Seychellois Creole (crs)\"\r\n  },\r\n  {\r\n    \"key\": \"shn\",\r\n    \"code\": \"shn\",\r\n    \"name\": \"Shan\",\r\n    \"text\": \"Shan (shn)\"\r\n  },\r\n  {\r\n    \"key\": \"sn\",\r\n    \"code\": \"sn\",\r\n    \"name\": \"Shona\",\r\n    \"text\": \"Shona (sn)\"\r\n  },\r\n  {\r\n    \"key\": \"scn\",\r\n    \"code\": \"scn\",\r\n    \"name\": \"Sicilian\",\r\n    \"text\": \"Sicilian (scn)\"\r\n  },\r\n  {\r\n    \"key\": \"szl\",\r\n    \"code\": \"szl\",\r\n    \"name\": \"Silesian\",\r\n    \"text\": \"Silesian (szl)\"\r\n  },\r\n  {\r\n    \"key\": \"sd\",\r\n    \"code\": \"sd\",\r\n    \"name\": \"Sindhi\",\r\n    \"text\": \"Sindhi (sd)\"\r\n  },\r\n  {\r\n    \"key\": \"si\",\r\n    \"code\": \"si\",\r\n    \"name\": \"Sinhala\",\r\n    \"text\": \"Sinhala (si)\"\r\n  },\r\n  {\r\n    \"key\": \"sk\",\r\n    \"code\": \"sk\",\r\n    \"name\": \"Slovak\",\r\n    \"text\": \"Slovak (sk)\"\r\n  },\r\n  {\r\n    \"key\": \"sl\",\r\n    \"code\": \"sl\",\r\n    \"name\": \"Slovenian\",\r\n    \"text\": \"Slovenian (sl)\"\r\n  },\r\n  {\r\n    \"key\": \"so\",\r\n    \"code\": \"so\",\r\n    \"name\": \"Somali\",\r\n    \"text\": \"Somali (so)\"\r\n  },\r\n  {\r\n    \"key\": \"es\",\r\n    \"code\": \"es\",\r\n    \"name\": \"Spanish\",\r\n    \"text\": \"Spanish (es)\"\r\n  },\r\n  {\r\n    \"key\": \"su\",\r\n    \"code\": \"su\",\r\n    \"name\": \"Sundanese\",\r\n    \"text\": \"Sundanese (su)\"\r\n  },\r\n  {\r\n    \"key\": \"sw\",\r\n    \"code\": \"sw\",\r\n    \"name\": \"Swahili\",\r\n    \"text\": \"Swahili (sw)\"\r\n  },\r\n  {\r\n    \"key\": \"ss\",\r\n    \"code\": \"ss\",\r\n    \"name\": \"Swati\",\r\n    \"text\": \"Swati (ss)\"\r\n  },\r\n  {\r\n    \"key\": \"sv\",\r\n    \"code\": \"sv\",\r\n    \"name\": \"Swedish\",\r\n    \"text\": \"Swedish (sv)\"\r\n  },\r\n  {\r\n    \"key\": \"tg\",\r\n    \"code\": \"tg\",\r\n    \"name\": \"Tajik\",\r\n    \"text\": \"Tajik (tg)\"\r\n  },\r\n  {\r\n    \"key\": \"ta\",\r\n    \"code\": \"ta\",\r\n    \"name\": \"Tamil\",\r\n    \"text\": \"Tamil (ta)\"\r\n  },\r\n  {\r\n    \"key\": \"tt\",\r\n    \"code\": \"tt\",\r\n    \"name\": \"Tatar\",\r\n    \"text\": \"Tatar (tt)\"\r\n  },\r\n  {\r\n    \"key\": \"te\",\r\n    \"code\": \"te\",\r\n    \"name\": \"Telugu\",\r\n    \"text\": \"Telugu (te)\"\r\n  },\r\n  {\r\n    \"key\": \"tet\",\r\n    \"code\": \"tet\",\r\n    \"name\": \"Tetum\",\r\n    \"text\": \"Tetum (tet)\"\r\n  },\r\n  {\r\n    \"key\": \"th\",\r\n    \"code\": \"th\",\r\n    \"name\": \"Thai\",\r\n    \"text\": \"Thai (th)\"\r\n  },\r\n  {\r\n    \"key\": \"ti\",\r\n    \"code\": \"ti\",\r\n    \"name\": \"Tigrinya\",\r\n    \"text\": \"Tigrinya (ti)\"\r\n  },\r\n  {\r\n    \"key\": \"ts\",\r\n    \"code\": \"ts\",\r\n    \"name\": \"Tsonga\",\r\n    \"text\": \"Tsonga (ts)\"\r\n  },\r\n  {\r\n    \"key\": \"tn\",\r\n    \"code\": \"tn\",\r\n    \"name\": \"Tswana\",\r\n    \"text\": \"Tswana (tn)\"\r\n  },\r\n  {\r\n    \"key\": \"tr\",\r\n    \"code\": \"tr\",\r\n    \"name\": \"Turkish\",\r\n    \"text\": \"Turkish (tr)\"\r\n  },\r\n  {\r\n    \"key\": \"tk\",\r\n    \"code\": \"tk\",\r\n    \"name\": \"Turkmen\",\r\n    \"text\": \"Turkmen (tk)\"\r\n  },\r\n  {\r\n    \"key\": \"ak\",\r\n    \"code\": \"ak\",\r\n    \"name\": \"Twi\",\r\n    \"text\": \"Twi (ak)\"\r\n  },\r\n  {\r\n    \"key\": \"uk\",\r\n    \"code\": \"uk\",\r\n    \"name\": \"Ukrainian\",\r\n    \"text\": \"Ukrainian (uk)\"\r\n  },\r\n  {\r\n    \"key\": \"ur\",\r\n    \"code\": \"ur\",\r\n    \"name\": \"Urdu\",\r\n    \"text\": \"Urdu (ur)\"\r\n  },\r\n  {\r\n    \"key\": \"ug\",\r\n    \"code\": \"ug\",\r\n    \"name\": \"Uyghur\",\r\n    \"text\": \"Uyghur (ug)\"\r\n  },\r\n  {\r\n    \"key\": \"uz\",\r\n    \"code\": \"uz\",\r\n    \"name\": \"Uzbek\",\r\n    \"text\": \"Uzbek (uz)\"\r\n  },\r\n  {\r\n    \"key\": \"vi\",\r\n    \"code\": \"vi\",\r\n    \"name\": \"Vietnamese\",\r\n    \"text\": \"Vietnamese (vi)\"\r\n  },\r\n  {\r\n    \"key\": \"cy\",\r\n    \"code\": \"cy\",\r\n    \"name\": \"Welsh\",\r\n    \"text\": \"Welsh (cy)\"\r\n  },\r\n  {\r\n    \"key\": \"xh\",\r\n    \"code\": \"xh\",\r\n    \"name\": \"Xhosa\",\r\n    \"text\": \"Xhosa (xh)\"\r\n  },\r\n  {\r\n    \"key\": \"yi\",\r\n    \"code\": \"yi\",\r\n    \"name\": \"Yiddish\",\r\n    \"text\": \"Yiddish (yi)\"\r\n  },\r\n  {\r\n    \"key\": \"yo\",\r\n    \"code\": \"yo\",\r\n    \"name\": \"Yoruba\",\r\n    \"text\": \"Yoruba (yo)\"\r\n  },\r\n  {\r\n    \"key\": \"yua\",\r\n    \"code\": \"yua\",\r\n    \"name\": \"Yucatec Maya\",\r\n    \"text\": \"Yucatec Maya (yua)\"\r\n  },\r\n  {\r\n    \"key\": \"zu\",\r\n    \"code\": \"zu\",\r\n    \"name\": \"Zulu\",\r\n    \"text\": \"Zulu (zu)\"\r\n  }\r\n]",
    "plm/translator/app/view/App.view.xml": "<mvc:View\r\n    controllerName=\"plm.translator.app.controller.App\"\r\n    xmlns:mvc=\"sap.ui.core.mvc\"\r\n    xmlns=\"sap.m\"\r\n    displayBlock=\"true\">\r\n    <Page showHeader=\"true\" enableScrolling=\"false\">\r\n        <customHeader>\r\n            <Bar class=\"plmShellHeader\">\r\n                <contentLeft>\r\n                    <Title text=\"PLM Translator\" level=\"H2\" class=\"sapUiSmallMarginBegin\"/>\r\n                    <ObjectStatus text=\"Google Cloud API v2\" state=\"Information\" class=\"sapUiTinyMarginBegin\"/>\r\n                </contentLeft>\r\n                <contentMiddle>\r\n                    <SegmentedButton id=\"navSegmentedBtn\" selectedKey=\"translator\" selectionChange=\".onNavSelect\">\r\n                        <items>\r\n                            <SegmentedButtonItem key=\"translator\" icon=\"sap-icon://translate\" text=\"Single Translation\"/>\r\n                            <SegmentedButtonItem key=\"massTranslation\" icon=\"sap-icon://excel-attachment\" text=\"Mass Translation\"/>\r\n                            <SegmentedButtonItem key=\"testResults\" icon=\"sap-icon://chart-table-view\" text=\"Test Results\"/>\r\n                        </items>\r\n                    </SegmentedButton>\r\n                </contentMiddle>\r\n                <contentRight>\r\n                    <HBox alignItems=\"Center\" renderType=\"Bare\" class=\"sapUiSmallMarginEnd\">\r\n                        <Avatar displaySize=\"XS\" initials=\"US\" backgroundColor=\"Accent6\" class=\"sapUiTinyMarginEnd\"/>\r\n                        <Text text=\"{appModel>/currentUser}\"/>\r\n                    </HBox>\r\n                </contentRight>\r\n            </Bar>\r\n        </customHeader>\r\n        <content>\r\n            <App id=\"appContainer\"/>\r\n        </content>\r\n    </Page>\r\n</mvc:View>\r\n",
    "plm/translator/app/view/MassTranslation.view.xml": "<mvc:View\r\n    controllerName=\"plm.translator.app.controller.MassTranslation\"\r\n    xmlns:mvc=\"sap.ui.core.mvc\"\r\n    xmlns=\"sap.m\"\r\n    xmlns:u=\"sap.ui.unified\"\r\n    xmlns:layout=\"sap.ui.layout\"\r\n    xmlns:core=\"sap.ui.core\">\r\n\r\n    <Page showHeader=\"false\" enableScrolling=\"true\" class=\"sapUiContentPadding\">\r\n        <content>\r\n            <!-- Banner Header -->\r\n            <VBox class=\"plmHeaderBanner sapUiSmallMarginBottom\">\r\n                <Title text=\"Mass Translation via Excel\" level=\"H2\"/>\r\n                <Text text=\"Upload an Excel workbook containing multiple text entries, choose target languages, and batch translate with automatic database logging.\"/>\r\n            </VBox>\r\n\r\n            <!-- Configuration & Upload Card -->\r\n            <VBox class=\"plmCard sapUiSmallMarginBottom\">\r\n                <Toolbar>\r\n                    <core:Icon src=\"sap-icon://excel-attachment\" class=\"sapUiTinyMarginEnd\"/>\r\n                    <Title text=\"Batch Configuration &amp; File Upload\" level=\"H4\"/>\r\n                    <ToolbarSpacer/>\r\n                    <Button\r\n                        id=\"btnDownloadTemplateHeader\"\r\n                        text=\"Download Template (.xlsx)\"\r\n                        icon=\"sap-icon://download\"\r\n                        type=\"Emphasized\"\r\n                        press=\".onDownloadTemplate\"/>\r\n                </Toolbar>\r\n\r\n                <VBox class=\"sapUiMediumMargin\">\r\n                    <!-- Informational Banner for Template -->\r\n                    <MessageStrip\r\n                        text=\"Need the pre-formatted Excel structure? Click 'Download Template (.xlsx)' above or use the link below.\"\r\n                        type=\"Information\"\r\n                        showIcon=\"true\"\r\n                        class=\"sapUiSmallMarginBottom\"/>\r\n\r\n                    <layout:Grid defaultSpan=\"XL6 L6 M12 S12\">\r\n\r\n                        <!-- Left Side: File Upload & Tester -->\r\n                        <VBox>\r\n                            <HBox justifyContent=\"SpaceBetween\" alignItems=\"Center\" class=\"sapUiTinyMarginBottom\">\r\n                                <Label text=\"Excel File (.xlsx, .xls):\" required=\"true\"/>\r\n                                <Link text=\"Download Blank Template (.xlsx)\" icon=\"sap-icon://download\" press=\".onDownloadTemplate\"/>\r\n                            </HBox>\r\n                            <HBox alignItems=\"Center\">\r\n                                <u:FileUploader\r\n                                    id=\"excelFileUploader\"\r\n                                    name=\"file\"\r\n                                    uploadUrl=\"/api/upload-and-translate\"\r\n                                    fileType=\"xlsx,xls\"\r\n                                    mimeType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel\"\r\n                                    placeholder=\"Choose an Excel file...\"\r\n                                    change=\".onFileSelected\"\r\n                                    width=\"100%\"/>\r\n                            </HBox>\r\n                            <Text text=\"Tip: Standard column header is 'Text', 'Source Text', or 'Content'\" class=\"sapUiTinyMarginTop\"/>\r\n\r\n                            <Label text=\"Tested By / Evaluator:\" required=\"true\" class=\"sapUiSmallMarginTop sapUiTinyMarginBottom\"/>\r\n                            <Input\r\n                                id=\"massTestedByInput\"\r\n                                value=\"{appModel>/currentUser}\"\r\n                                placeholder=\"Enter your name or user ID\"/>\r\n                        </VBox>\r\n\r\n                        <!-- Right Side: Target Languages Multi-Selection -->\r\n                        <VBox>\r\n                            <HBox justifyContent=\"SpaceBetween\" alignItems=\"Center\" class=\"sapUiTinyMarginBottom\">\r\n                                <Label text=\"Target Languages:\" required=\"true\"/>\r\n                                <HBox>\r\n                                    <Link text=\"Select Top 5\" press=\".onSelectTopLanguages\" class=\"sapUiTinyMarginEnd\"/>\r\n                                    <Link text=\"Clear All\" press=\".onClearLanguages\"/>\r\n                                </HBox>\r\n                            </HBox>\r\n                            <MultiComboBox\r\n                                id=\"targetLanguagesMultiCombo\"\r\n                                items=\"{path: 'appModel>/languages'}\"\r\n                                width=\"100%\"\r\n                                placeholder=\"Select one or more languages...\">\r\n                                <core:Item key=\"{appModel>key}\" text=\"{appModel>text}\"/>\r\n                            </MultiComboBox>\r\n                            <Text text=\"You can select multiple languages to perform multi-target translations simultaneously.\" class=\"sapUiTinyMarginTop\"/>\r\n                        </VBox>\r\n\r\n                    </layout:Grid>\r\n\r\n                    <!-- Execute Button -->\r\n                    <Toolbar height=\"4rem\" class=\"sapUiSmallMarginTop\">\r\n                        <ToolbarSpacer/>\r\n                        <Button\r\n                            id=\"btnUploadAndTranslate\"\r\n                            text=\"Upload &amp; Start Mass Translation\"\r\n                            icon=\"sap-icon://begin\"\r\n                            type=\"Emphasized\"\r\n                            press=\".onUploadAndTranslate\"/>\r\n                    </Toolbar>\r\n                </VBox>\r\n            </VBox>\r\n\r\n            <!-- Results Summary & Statistics (Visible after execution) -->\r\n            <VBox id=\"statsSection\" visible=\"false\" class=\"sapUiSmallMarginBottom\">\r\n                <layout:Grid defaultSpan=\"XL3 L3 M6 S12\">\r\n\r\n                    <!-- Total Rows KPI -->\r\n                    <VBox class=\"plmKpiCard\">\r\n                        <Text id=\"kpiTotalRows\" text=\"0\" class=\"plmKpiValue plmKpiInfo\"/>\r\n                        <Text text=\"Total Source Texts\" class=\"plmKpiLabel\"/>\r\n                    </VBox>\r\n\r\n                    <!-- Successful KPI -->\r\n                    <VBox class=\"plmKpiCard\">\r\n                        <Text id=\"kpiSuccessful\" text=\"0\" class=\"plmKpiValue plmKpiSuccess\"/>\r\n                        <Text text=\"Successful Translations\" class=\"plmKpiLabel\"/>\r\n                    </VBox>\r\n\r\n                    <!-- Failed KPI -->\r\n                    <VBox class=\"plmKpiCard\">\r\n                        <Text id=\"kpiFailed\" text=\"0\" class=\"plmKpiValue plmKpiError\"/>\r\n                        <Text text=\"Failed Rows\" class=\"plmKpiLabel\"/>\r\n                    </VBox>\r\n\r\n                    <!-- Success Rate KPI -->\r\n                    <VBox class=\"plmKpiCard\">\r\n                        <Text id=\"kpiSuccessRate\" text=\"100%\" class=\"plmKpiValue plmKpiSuccess\"/>\r\n                        <Text text=\"Success Rate\" class=\"plmKpiLabel\"/>\r\n                    </VBox>\r\n\r\n                </layout:Grid>\r\n            </VBox>\r\n\r\n            <!-- Results Data Table Card (Visible after execution) -->\r\n            <VBox id=\"resultsTableCard\" visible=\"false\" class=\"plmCard\">\r\n                <Toolbar>\r\n                    <core:Icon src=\"sap-icon://table-view\" class=\"sapUiTinyMarginEnd\"/>\r\n                    <Title text=\"Session Translation Results\" level=\"H4\"/>\r\n                    <ToolbarSpacer/>\r\n                    <Button\r\n                        id=\"btnDownloadSessionExcel\"\r\n                        text=\"Download Results (.xlsx)\"\r\n                        icon=\"sap-icon://download\"\r\n                        type=\"Emphasized\"\r\n                        press=\".onDownloadSessionResults\"/>\r\n                </Toolbar>\r\n\r\n                <Table\r\n                    id=\"sessionResultsTable\"\r\n                    items=\"{sessionModel>/results}\"\r\n                    growing=\"true\"\r\n                    growingThreshold=\"20\"\r\n                    noDataText=\"No translation results generated yet\">\r\n                    <columns>\r\n                        <Column width=\"5rem\"><Text text=\"#\"/></Column>\r\n                        <Column width=\"8rem\"><Text text=\"Outcome\"/></Column>\r\n                        <Column width=\"7rem\"><Text text=\"Language\"/></Column>\r\n                        <Column><Text text=\"Original Text\"/></Column>\r\n                        <Column><Text text=\"Translated Text\"/></Column>\r\n                    </columns>\r\n                    <items>\r\n                        <ColumnListItem>\r\n                            <cells>\r\n                                <Text text=\"{sessionModel>rowIndex}\"/>\r\n                                <ObjectStatus\r\n                                    text=\"{sessionModel>outcome}\"\r\n                                    state=\"{= ${sessionModel>outcome} === 'Success' ? 'Success' : 'Error' }\"/>\r\n                                <Text text=\"{sessionModel>targetLanguage}\"/>\r\n                                <Text text=\"{sessionModel>sourceText}\"/>\r\n                                <Text text=\"{sessionModel>translatedText}\"/>\r\n                            </cells>\r\n                        </ColumnListItem>\r\n                    </items>\r\n                </Table>\r\n            </VBox>\r\n\r\n        </content>\r\n    </Page>\r\n</mvc:View>\r\n",
    "plm/translator/app/view/TestResults.view.xml": "<mvc:View\r\n    controllerName=\"plm.translator.app.controller.TestResults\"\r\n    xmlns:mvc=\"sap.ui.core.mvc\"\r\n    xmlns=\"sap.m\"\r\n    xmlns:layout=\"sap.ui.layout\"\r\n    xmlns:core=\"sap.ui.core\">\r\n\r\n    <Page showHeader=\"false\" enableScrolling=\"true\" class=\"sapUiContentPadding\">\r\n        <content>\r\n            <!-- Banner Header -->\r\n            <VBox class=\"plmHeaderBanner sapUiSmallMarginBottom\">\r\n                <Title text=\"Translation Test Results\" level=\"H2\"/>\r\n                <Text text=\"Central repository of all translation test cases, quality metrics, and evaluation history.\"/>\r\n            </VBox>\r\n\r\n            <!-- KPI Tiles Grid -->\r\n            <layout:Grid defaultSpan=\"XL3 L3 M6 S12\" class=\"sapUiSmallMarginBottom\">\r\n                <!-- Total Tests -->\r\n                <VBox class=\"plmKpiCard\">\r\n                    <Text id=\"kpiTotalTests\" text=\"{resultsStatsModel>/totalTests}\" class=\"plmKpiValue plmKpiInfo\"/>\r\n                    <Text text=\"Total Tests Logged\" class=\"plmKpiLabel\"/>\r\n                </VBox>\r\n\r\n                <!-- Success Rate -->\r\n                <VBox class=\"plmKpiCard\">\r\n                    <Text id=\"kpiOverallSuccessRate\" text=\"{resultsStatsModel>/successRate}%\" class=\"plmKpiValue plmKpiSuccess\"/>\r\n                    <Text text=\"Overall Accuracy / Pass Rate\" class=\"plmKpiLabel\"/>\r\n                </VBox>\r\n\r\n                <!-- Passed -->\r\n                <VBox class=\"plmKpiCard\">\r\n                    <Text id=\"kpiPassedCount\" text=\"{resultsStatsModel>/passedCount}\" class=\"plmKpiValue plmKpiSuccess\"/>\r\n                    <Text text=\"Passed (Success)\" class=\"plmKpiLabel\"/>\r\n                </VBox>\r\n\r\n                <!-- Failed -->\r\n                <VBox class=\"plmKpiCard\">\r\n                    <Text id=\"kpiFailedCount\" text=\"{resultsStatsModel>/failedCount}\" class=\"plmKpiValue plmKpiError\"/>\r\n                    <Text text=\"Failed / Partial\" class=\"plmKpiLabel\"/>\r\n                </VBox>\r\n            </layout:Grid>\r\n\r\n            <!-- Table Card with Filtering & Export -->\r\n            <VBox class=\"plmCard\">\r\n                <Toolbar class=\"sapUiTinyMarginBottom\">\r\n                    <core:Icon src=\"sap-icon://filter\" class=\"sapUiTinyMarginEnd\"/>\r\n                    <Title text=\"Test Records\" level=\"H4\"/>\r\n                    <ToolbarSpacer/>\r\n\r\n                    <!-- Search Input -->\r\n                    <SearchField\r\n                        id=\"searchField\"\r\n                        placeholder=\"Search text or tester...\"\r\n                        width=\"240px\"\r\n                        search=\".onSearchFilter\"\r\n                        class=\"sapUiTinyMarginEnd\"/>\r\n\r\n                    <!-- Outcome Filter -->\r\n                    <Select\r\n                        id=\"outcomeFilterSelect\"\r\n                        change=\".onFilterChange\"\r\n                        selectedKey=\"ALL\"\r\n                        width=\"140px\"\r\n                        class=\"sapUiTinyMarginEnd\">\r\n                        <items>\r\n                            <core:Item key=\"ALL\" text=\"All Outcomes\"/>\r\n                            <core:Item key=\"Success\" text=\"Success\"/>\r\n                            <core:Item key=\"Partial\" text=\"Partial\"/>\r\n                            <core:Item key=\"Failure\" text=\"Failure\"/>\r\n                        </items>\r\n                    </Select>\r\n\r\n                    <!-- Export Excel Button -->\r\n                    <Button\r\n                        text=\"Export to Excel\"\r\n                        icon=\"sap-icon://excel-attachment\"\r\n                        type=\"Emphasized\"\r\n                        press=\".onExportExcel\"\r\n                        class=\"sapUiTinyMarginEnd\"/>\r\n\r\n                    <!-- Refresh Button -->\r\n                    <Button\r\n                        icon=\"sap-icon://refresh\"\r\n                        tooltip=\"Refresh list\"\r\n                        type=\"Transparent\"\r\n                        press=\".onRefreshData\"/>\r\n                </Toolbar>\r\n\r\n                <Table\r\n                    id=\"testResultsTable\"\r\n                    items=\"{\r\n                        path: 'resultsModel>/items',\r\n                        sorter: { path: 'createdAt', descending: true }\r\n                    }\"\r\n                    growing=\"true\"\r\n                    growingThreshold=\"25\"\r\n                    noDataText=\"No translation test results recorded yet\">\r\n                    <columns>\r\n                        <Column width=\"7rem\"><Text text=\"Outcome\"/></Column>\r\n                        <Column width=\"6rem\"><Text text=\"Accuracy\"/></Column>\r\n                        <Column width=\"20%\"><Text text=\"Original Text\"/></Column>\r\n                        <Column width=\"25%\"><Text text=\"Translated Text\"/></Column>\r\n                        <Column width=\"10rem\"><Text text=\"Target Lang\"/></Column>\r\n                        <Column width=\"9rem\"><Text text=\"Tested By\"/></Column>\r\n                        <Column width=\"9rem\"><Text text=\"Date\"/></Column>\r\n                        <Column width=\"6rem\" hAlign=\"End\"><Text text=\"Actions\"/></Column>\r\n                    </columns>\r\n                    <items>\r\n                        <ColumnListItem>\r\n                            <cells>\r\n                                <ObjectStatus\r\n                                    text=\"{resultsModel>outcome}\"\r\n                                    state=\"{= ${resultsModel>outcome} === 'Success' ? 'Success' : (${resultsModel>outcome} === 'Partial' ? 'Warning' : 'Error') }\"\r\n                                    icon=\"{= ${resultsModel>outcome} === 'Success' ? 'sap-icon://sys-enter-2' : (${resultsModel>outcome} === 'Partial' ? 'sap-icon://alert' : 'sap-icon://error') }\"/>\r\n\r\n                                <ObjectNumber\r\n                                    number=\"{\r\n                                        path: 'resultsModel>accuracy',\r\n                                        formatter: '.formatAccuracy'\r\n                                    }\"\r\n                                    unit=\"{\r\n                                        path: 'resultsModel>accuracy',\r\n                                        formatter: '.formatAccuracyUnit'\r\n                                    }\"\r\n                                    state=\"{\r\n                                        path: 'resultsModel>accuracy',\r\n                                        formatter: '.formatAccuracyState'\r\n                                    }\"/>\r\n\r\n                                <Text text=\"{resultsModel>textToTranslate}\" maxLines=\"2\"/>\r\n\r\n                                <Text text=\"{resultsModel>translatedText}\" maxLines=\"2\"/>\r\n\r\n                                <Text text=\"{resultsModel>targetLanguage}\"/>\r\n\r\n                                <Text text=\"{resultsModel>testedBy}\"/>\r\n\r\n                                <Text text=\"{\r\n                                    path: 'resultsModel>createdAt',\r\n                                    formatter: '.formatDate'\r\n                                }\"/>\r\n\r\n                                <HBox justifyContent=\"End\">\r\n                                    <Button\r\n                                        icon=\"sap-icon://hint\"\r\n                                        tooltip=\"View Details\"\r\n                                        type=\"Transparent\"\r\n                                        press=\".onViewDetails\"/>\r\n                                    <Button\r\n                                        icon=\"sap-icon://delete\"\r\n                                        tooltip=\"Delete\"\r\n                                        type=\"Transparent\"\r\n                                        press=\".onDeleteRecord\"/>\r\n                                </HBox>\r\n                            </cells>\r\n                        </ColumnListItem>\r\n                    </items>\r\n                </Table>\r\n            </VBox>\r\n\r\n        </content>\r\n    </Page>\r\n</mvc:View>\r\n",
    "plm/translator/app/view/Translator.view.xml": "<mvc:View\r\n    controllerName=\"plm.translator.app.controller.Translator\"\r\n    xmlns:mvc=\"sap.ui.core.mvc\"\r\n    xmlns=\"sap.m\"\r\n    xmlns:layout=\"sap.ui.layout\"\r\n    xmlns:core=\"sap.ui.core\">\r\n\r\n    <Page showHeader=\"false\" enableScrolling=\"true\" class=\"sapUiContentPadding\">\r\n        <content>\r\n            <!-- Banner Header -->\r\n            <VBox class=\"plmHeaderBanner sapUiSmallMarginBottom\">\r\n                <Title text=\"Single Text Translation\" level=\"H2\"/>\r\n                <Text text=\"Translate text instantly with Google Cloud Translation API v2 and record test evaluations.\"/>\r\n            </VBox>\r\n\r\n            <!-- Main Layout: 2 Columns for Translation + Evaluation -->\r\n            <layout:Grid defaultSpan=\"XL6 L6 M12 S12\" class=\"sapUiNoMarginTop\">\r\n\r\n                <!-- Left Column: Source Text Panel -->\r\n                <VBox class=\"plmCard sapUiSmallMarginBottom\">\r\n                    <Toolbar class=\"sapUiTinyMarginBottom\">\r\n                        <core:Icon src=\"sap-icon://edit\" class=\"sapUiTinyMarginEnd\"/>\r\n                        <Title text=\"Source Text\" level=\"H4\"/>\r\n                        <ToolbarSpacer/>\r\n                        <Label text=\"Target Language:\" class=\"sapUiTinyMarginEnd\"/>\r\n                        <ComboBox\r\n                            id=\"targetLanguageSelect\"\r\n                            selectedKey=\"de\"\r\n                            items=\"{path: 'appModel>/languages'}\"\r\n                            width=\"260px\"\r\n                            showSecondaryValues=\"true\"\r\n                            filterSecondaryValues=\"true\"\r\n                            placeholder=\"Select language...\">\r\n                            <core:ListItem key=\"{appModel>key}\" text=\"{appModel>text}\" additionalText=\"{appModel>code}\"/>\r\n                        </ComboBox>\r\n                    </Toolbar>\r\n\r\n                    <VBox class=\"sapUiSmallMargin\">\r\n                        <TextArea\r\n                            id=\"sourceTextArea\"\r\n                            width=\"100%\"\r\n                            rows=\"8\"\r\n                            growing=\"true\"\r\n                            growingMaxLines=\"12\"\r\n                            placeholder=\"Type or paste text to translate here...\"\r\n                            liveChange=\".onSourceTextLiveChange\"\r\n                            class=\"plmTextArea\"/>\r\n\r\n                        <Toolbar height=\"3rem\" class=\"sapUiTinyMarginTop\">\r\n                            <Text id=\"charCountText\" text=\"0 characters\"/>\r\n                            <ToolbarSpacer/>\r\n                            <Button\r\n                                text=\"Clear\"\r\n                                icon=\"sap-icon://clear-all\"\r\n                                press=\".onClearText\"\r\n                                type=\"Transparent\"\r\n                                class=\"sapUiTinyMarginEnd\"/>\r\n                            <Button\r\n                                id=\"btnTranslate\"\r\n                                text=\"Translate\"\r\n                                icon=\"sap-icon://translate\"\r\n                                type=\"Emphasized\"\r\n                                press=\".onTranslate\"/>\r\n                        </Toolbar>\r\n                    </VBox>\r\n                </VBox>\r\n\r\n                <!-- Right Column: Translated Text Output -->\r\n                <VBox class=\"plmCard sapUiSmallMarginBottom\">\r\n                    <Toolbar class=\"sapUiTinyMarginBottom\">\r\n                        <core:Icon src=\"sap-icon://translate\" class=\"sapUiTinyMarginEnd\"/>\r\n                        <Title text=\"Translated Result\" level=\"H4\"/>\r\n                        <ToolbarSpacer/>\r\n                        <ObjectStatus\r\n                            id=\"detectedLanguageStatus\"\r\n                            text=\"Ready\"\r\n                            state=\"None\"\r\n                            class=\"sapUiTinyMarginEnd\"/>\r\n                        <Button\r\n                            id=\"btnCopy\"\r\n                            icon=\"sap-icon://copy\"\r\n                            tooltip=\"Copy translated text\"\r\n                            press=\".onCopyTranslation\"\r\n                            enabled=\"false\"/>\r\n                    </Toolbar>\r\n\r\n                    <VBox class=\"sapUiSmallMargin\">\r\n                        <TextArea\r\n                            id=\"translatedTextArea\"\r\n                            width=\"100%\"\r\n                            rows=\"8\"\r\n                            growing=\"true\"\r\n                            growingMaxLines=\"12\"\r\n                            editable=\"false\"\r\n                            placeholder=\"Translation output will appear here...\"\r\n                            class=\"plmTextArea plmOutputArea\"/>\r\n\r\n                        <Toolbar height=\"3rem\" class=\"sapUiTinyMarginTop\">\r\n                            <Text id=\"translatedCharCountText\" text=\"0 characters\"/>\r\n                            <ToolbarSpacer/>\r\n                            <ObjectStatus\r\n                                id=\"translationStatusText\"\r\n                                text=\"\"\r\n                                state=\"None\"/>\r\n                        </Toolbar>\r\n                    </VBox>\r\n                </VBox>\r\n\r\n            </layout:Grid>\r\n\r\n            <!-- Test Result Evaluation Panel (Saves to TestResults CDS Entity) -->\r\n            <VBox class=\"plmCard sapUiSmallMarginTop\">\r\n                <Toolbar>\r\n                    <core:Icon src=\"sap-icon://check-availability\" class=\"sapUiTinyMarginEnd\"/>\r\n                    <Title text=\"Log Test Evaluation\" level=\"H4\"/>\r\n                    <ToolbarSpacer/>\r\n                    <Text text=\"Evaluate accuracy and persist outcome to database\" class=\"sapUiTinyMarginEnd\"/>\r\n                </Toolbar>\r\n\r\n                <VBox class=\"sapUiMediumMargin\">\r\n                    <layout:Grid defaultSpan=\"XL4 L4 M6 S12\">\r\n\r\n                        <!-- Outcome Selector -->\r\n                        <VBox>\r\n                            <Label text=\"Test Outcome:\" required=\"true\" class=\"sapUiTinyMarginBottom\"/>\r\n                            <RadioButtonGroup id=\"outcomeRadioGroup\" columns=\"3\" selectedIndex=\"0\">\r\n                                <buttons>\r\n                                    <RadioButton text=\"Success\"/>\r\n                                    <RadioButton text=\"Partial\"/>\r\n                                    <RadioButton text=\"Failure\"/>\r\n                                </buttons>\r\n                            </RadioButtonGroup>\r\n                        </VBox>\r\n\r\n                        <!-- Accuracy Slider -->\r\n                        <VBox>\r\n                            <HBox justifyContent=\"SpaceBetween\" alignItems=\"Center\">\r\n                                <Label text=\"Translation Accuracy (%):\" required=\"true\"/>\r\n                                <Text id=\"accuracyValueText\" text=\"100%\" class=\"sapUiTinyMarginBegin\"/>\r\n                            </HBox>\r\n                            <Slider\r\n                                id=\"accuracySlider\"\r\n                                value=\"100\"\r\n                                min=\"0\"\r\n                                max=\"100\"\r\n                                step=\"5\"\r\n                                enableTickmarks=\"true\"\r\n                                liveChange=\".onAccuracySliderChange\"/>\r\n                        </VBox>\r\n\r\n                        <!-- Tested By -->\r\n                        <VBox>\r\n                            <Label text=\"Tested By:\" required=\"true\" class=\"sapUiTinyMarginBottom\"/>\r\n                            <Input\r\n                                id=\"testedByInput\"\r\n                                value=\"{appModel>/currentUser}\"\r\n                                placeholder=\"Enter tester name or user ID\"/>\r\n                        </VBox>\r\n\r\n                    </layout:Grid>\r\n\r\n                    <!-- Observation Notes -->\r\n                    <VBox class=\"sapUiSmallMarginTop\">\r\n                        <Label text=\"Observations / Notes:\"/>\r\n                        <TextArea\r\n                            id=\"observationInput\"\r\n                            width=\"100%\"\r\n                            rows=\"3\"\r\n                            placeholder=\"Add specific comments, grammatical remarks, or PLM domain observations...\"/>\r\n                    </VBox>\r\n\r\n                    <!-- Action Bar -->\r\n                    <HBox justifyContent=\"End\" class=\"sapUiSmallMarginTop\">\r\n                        <Button\r\n                            id=\"btnSaveResult\"\r\n                            text=\"Save Test Result\"\r\n                            icon=\"sap-icon://save\"\r\n                            type=\"Emphasized\"\r\n                            press=\".onSaveTestResult\"\r\n                            enabled=\"false\"/>\r\n                    </HBox>\r\n                </VBox>\r\n            </VBox>\r\n\r\n        </content>\r\n    </Page>\r\n</mvc:View>\r\n"
});
