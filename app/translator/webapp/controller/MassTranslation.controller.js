// =============================================================
// PLM Translator - Mass Translation Controller
// =============================================================
// Handles:
// 1. Downloading sample Excel template
// 2. Multi-language selection helpers
// 3. Uploading Excel workbook & triggering batch translation
// 4. Presenting execution KPIs (Total rows, Success %, etc.)
// 5. Previewing results & exporting session results to Excel
// =============================================================

sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, JSONModel, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("plm.translator.app.controller.MassTranslation", {

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
            oLink.href = "/api/download-template-excel";
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

            fetch("/api/upload-and-translate", {
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

            fetch("/api/TestResults?$filter=sessionId eq '" + encodeURIComponent(sSessionId) + "'&$orderby=createdAt asc")
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
            fetch("/api/download-translation-results?session_id=" + encodeURIComponent(sSessionId), {
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
