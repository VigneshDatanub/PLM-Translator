// =============================================================
// PLM Translator - Test Results Controller
// =============================================================
// Manages persisted test records:
// 1. Loading and calculating overall KPIs
// 2. Real-time client-side search and outcome filtering
// 3. Detailed record viewing dialog
// 4. Deleting records via OData DELETE /api/TestResults(ID)
// 5. Triggering Excel export via /api/export-results-excel
// =============================================================

sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/VBox",
    "sap/m/Label",
    "sap/m/Text",
    "sap/m/TextArea"
], function (Controller, JSONModel, MessageToast, MessageBox, Dialog, Button, VBox, Label, Text, TextArea) {
    "use strict";

    return Controller.extend("plm.translator.app.controller.TestResults", {

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

            fetch("/api/TestResults?$orderby=createdAt desc")
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
            var nTotalAcc = 0;
            var nEvaluated = 0;

            for (var i = 0; i < nTotal; i++) {
                var item = aItems[i];
                if (item.outcome === "Success") {
                    nPassed++;
                } else {
                    nFailed++;
                }
                if (item.accuracy !== null && item.accuracy !== undefined && item.accuracy !== "") {
                    nTotalAcc += Number(item.accuracy);
                    nEvaluated++;
                }
            }

            // Overall accuracy: Average of human-evaluated tests.
            // If none evaluated, fallback to the pass rate percentage.
            var nRate = nEvaluated > 0
                ? Math.round(nTotalAcc / nEvaluated)
                : (nTotal > 0 ? Math.round((nPassed / nTotal) * 100) : 100);

            this._oStatsModel.setData({
                totalTests: nTotal,
                successRate: nRate,
                passedCount: nPassed,
                failedCount: nFailed
            });
        },

        /**
         * Search & Outcome Filtering
         */
        onSearchFilter: function () {
            this._applyFilters();
        },

        onFilterChange: function () {
            this._applyFilters();
        },

        _applyFilters: function () {
            var sQuery = (this.byId("searchField").getValue() || "").toLowerCase().trim();
            var sOutcome = this.byId("outcomeFilterSelect").getSelectedKey();

            var aFiltered = this._allItems.filter(function (item) {
                // Outcome filter
                if (sOutcome !== "ALL" && item.outcome !== sOutcome) {
                    return false;
                }

                // Query filter
                if (sQuery) {
                    var sSrc = (item.textToTranslate || "").toLowerCase();
                    var sTrans = (item.translatedText || "").toLowerCase();
                    var sObs = (item.observation || "").toLowerCase();
                    var sTester = (item.testedBy || "").toLowerCase();
                    var sLang = (item.targetLanguage || "").toLowerCase();

                    var bMatch = sSrc.indexOf(sQuery) !== -1 ||
                                 sTrans.indexOf(sQuery) !== -1 ||
                                 sObs.indexOf(sQuery) !== -1 ||
                                 sTester.indexOf(sQuery) !== -1 ||
                                 sLang.indexOf(sQuery) !== -1;
                    if (!bMatch) {
                        return false;
                    }
                }
                return true;
            });

            this._oResultsModel.setProperty("/items", aFiltered);
        },

        /**
         * Date Formatter
         */
        /**
         * Accuracy Formatters (Outputs 'N/A' for non-evaluated mass translations)
         */
        formatAccuracy: function (nAccuracy) {
            if (nAccuracy === null || nAccuracy === undefined || nAccuracy === "") {
                return "N/A";
            }
            return nAccuracy;
        },

        formatAccuracyUnit: function (nAccuracy) {
            if (nAccuracy === null || nAccuracy === undefined || nAccuracy === "") {
                return "";
            }
            return "%";
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
            var sUrl = "/api/export-results-excel";
            if (sOutcome && sOutcome !== "ALL") {
                sUrl += "?outcome=" + encodeURIComponent(sOutcome);
            }
            window.location.href = sUrl;
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
                        fetch("/api/TestResults(" + oData.ID + ")", {
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
