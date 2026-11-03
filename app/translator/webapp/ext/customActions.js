sap.ui.define([
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/VBox",
    "sap/m/HBox",
    "sap/m/Label",
    "sap/m/TextArea",
    "sap/m/Input",
    "sap/m/Select",
    "sap/m/ComboBox",
    "sap/m/MultiComboBox",
    "sap/m/Text",
    "sap/m/Title",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Item",
    "sap/ui/unified/FileUploader",
    "sap/ui/model/json/JSONModel"
], function (
    Dialog, Button, VBox, HBox, Label, TextArea, Input, Select,
    ComboBox, MultiComboBox, Text, Title, MessageToast, MessageBox,
    Item, FileUploader, JSONModel
) {
    "use strict";

    function getBaseUrl(sPath) {
        var sModulePath = sap.ui.require.toUrl("plm/translator/app");
        if (!sModulePath || sModulePath === ".") {
            return sPath.startsWith("/") ? sPath : "/" + sPath;
        }
        var sClean = sPath.startsWith("/") ? sPath.slice(1) : sPath;
        return sModulePath + "/" + sClean;
    }

    return {
        /**
         * Quick Single Translation Action Dialog
         */
        onQuickTranslate: function (oEvent) {
            var oView = this.editFlow ? this.editFlow.getView() : null;
            var oModel = new JSONModel({
                sourceText: "",
                targetLanguage: "de",
                translatedText: "",
                detectedLanguage: "",
                outcome: "Success",
                accuracy: 95,
                observation: "",
                testedBy: "Business User",
                isTranslating: false,
                isTranslated: false,
                languages: []
            });

            // Load languages dynamically
            fetch(getBaseUrl("api/getLanguages()"))
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    var aLangs = (data && data.value) ? data.value : (Array.isArray(data) ? data : []);
                    oModel.setProperty("/languages", aLangs);
                })
                .catch(function (e) {
                    console.warn("[QuickTranslate] Could not load languages dynamically:", e);
                });

            // Fetch user info for testedBy default
            fetch(getBaseUrl("api/getUserInfo()"))
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    var u = (data && data.value) ? data.value : data;
                    if (u && u.user) {
                        oModel.setProperty("/testedBy", u.user);
                    }
                })
                .catch(function () {});

            var oDialog = new Dialog({
                title: "Quick Single Translation & Evaluation",
                contentWidth: "680px",
                contentHeight: "auto",
                resizable: true,
                draggable: true,
                content: [
                    new VBox({
                        class: "sapUiMediumMargin",
                        items: [
                            new Label({ text: "Target Language:", required: true }),
                            new ComboBox({
                                width: "100%",
                                selectedKey: "{dialog>/targetLanguage}",
                                items: {
                                    path: "dialog>/languages",
                                    template: new Item({ key: "{dialog>code}", text: "{dialog>text}" })
                                }
                            }),

                            new Label({ text: "Source Text to Translate:", required: true, class: "sapUiTinyMarginTop" }),
                            new TextArea({
                                width: "100%",
                                rows: 4,
                                value: "{dialog>/sourceText}",
                                placeholder: "Enter source text to translate..."
                            }),

                            new HBox({
                                justifyContent: "End",
                                class: "sapUiTinyMarginTop",
                                items: [
                                    new Button({
                                        text: "Translate via Google Cloud",
                                        type: "Emphasized",
                                        icon: "sap-icon://translate",
                                        busy: "{dialog>/isTranslating}",
                                        press: function () {
                                            var sText = oModel.getProperty("/sourceText");
                                            var sLang = oModel.getProperty("/targetLanguage");
                                            if (!sText || !sText.trim()) {
                                                MessageToast.show("Please enter source text.");
                                                return;
                                            }
                                            oModel.setProperty("/isTranslating", true);
                                            fetch(getBaseUrl("api/translate"), {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ text: sText, targetLanguage: sLang })
                                            })
                                            .then(function (res) { return res.json(); })
                                            .then(function (resData) {
                                                oModel.setProperty("/isTranslating", false);
                                                var res = resData.value || resData;
                                                if (res.success) {
                                                    oModel.setProperty("/translatedText", res.translatedText);
                                                    oModel.setProperty("/detectedLanguage", res.sourceLanguage);
                                                    oModel.setProperty("/isTranslated", true);
                                                    MessageToast.show("Translation completed successfully!");
                                                } else {
                                                    MessageBox.error(res.error || "Translation failed");
                                                }
                                            })
                                            .catch(function (err) {
                                                oModel.setProperty("/isTranslating", false);
                                                MessageBox.error("Network error: " + err.message);
                                            });
                                        }
                                    })
                                ]
                            }),

                            new Label({ text: "Translated Result:", class: "sapUiSmallMarginTop" }),
                            new TextArea({
                                width: "100%",
                                rows: 4,
                                editable: false,
                                value: "{dialog>/translatedText}",
                                placeholder: "Translated result will appear here..."
                            }),

                            new Title({ text: "Record Test Quality & Evaluation", level: "H5", class: "sapUiSmallMarginTop" }),
                            new HBox({
                                items: [
                                    new VBox({
                                        width: "50%",
                                        class: "sapUiTinyMarginEnd",
                                        items: [
                                            new Label({ text: "Outcome:" }),
                                            new Select({
                                                width: "100%",
                                                selectedKey: "{dialog>/outcome}",
                                                items: [
                                                    new Item({ key: "Success", text: "Success (Accurate)" }),
                                                    new Item({ key: "Partial", text: "Partial (Needs Edit)" }),
                                                    new Item({ key: "Failure", text: "Failure (Inaccurate)" })
                                                ]
                                            })
                                        ]
                                    }),
                                    new VBox({
                                        width: "50%",
                                        items: [
                                            new Label({ text: "Accuracy Rating (0-100%):" }),
                                            new Input({
                                                type: "Number",
                                                value: "{dialog>/accuracy}",
                                                placeholder: "95"
                                            })
                                        ]
                                    })
                                ]
                            }),

                            new Label({ text: "Evaluator / Tested By:", class: "sapUiTinyMarginTop" }),
                            new Input({
                                value: "{dialog>/testedBy}",
                                placeholder: "Enter evaluator name"
                            }),

                            new Label({ text: "Observations & Notes:", class: "sapUiTinyMarginTop" }),
                            new TextArea({
                                width: "100%",
                                rows: 2,
                                value: "{dialog>/observation}",
                                placeholder: "Optional evaluation notes..."
                            })
                        ]
                    })
                ],
                beginButton: new Button({
                    text: "Save to Test Results",
                    type: "Accept",
                    icon: "sap-icon://save",
                    press: function () {
                        var oData = oModel.getData();
                        if (!oData.translatedText && !oData.sourceText) {
                            MessageToast.show("Please perform a translation before saving.");
                            return;
                        }

                        oDialog.setBusy(true);
                        var payload = {
                            outcome: oData.outcome,
                            accuracy: oData.accuracy ? parseFloat(oData.accuracy) : null,
                            observation: oData.observation || "",
                            testedBy: oData.testedBy || "Anonymous",
                            textToTranslate: oData.sourceText,
                            translatedText: oData.translatedText || "",
                            sourceLanguage: oData.detectedLanguage || "auto",
                            targetLanguage: oData.targetLanguage
                        };

                        fetch(getBaseUrl("api/TestResults"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(payload)
                        })
                        .then(function (res) { return res.json(); })
                        .then(function (saved) {
                            oDialog.setBusy(false);
                            oDialog.close();
                            oDialog.destroy();
                            MessageToast.show("Test evaluation logged successfully!");
                            // Refresh current FE view binding if available
                            if (oView && oView.getModel()) {
                                oView.getModel().refresh();
                            }
                        })
                        .catch(function (err) {
                            oDialog.setBusy(false);
                            MessageBox.error("Failed to save evaluation: " + err.message);
                        });
                    }
                }),
                endButton: new Button({
                    text: "Cancel",
                    press: function () {
                        oDialog.close();
                        oDialog.destroy();
                    }
                })
            });

            oDialog.setModel(oModel, "dialog");
            oDialog.open();
        },

        /**
         * Mass Translation Excel Upload Action Dialog
         */
        onMassUpload: function (oEvent) {
            var oView = this.editFlow ? this.editFlow.getView() : null;
            var oModel = new JSONModel({
                testedBy: "Business User",
                targetLanguages: ["de", "fr", "es"],
                languages: [],
                statusText: ""
            });

            fetch(getBaseUrl("api/getLanguages()"))
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    var aLangs = (data && data.value) ? data.value : (Array.isArray(data) ? data : []);
                    oModel.setProperty("/languages", aLangs);
                })
                .catch(function () {});

            fetch(getBaseUrl("api/getUserInfo()"))
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    var u = (data && data.value) ? data.value : data;
                    if (u && u.user) {
                        oModel.setProperty("/testedBy", u.user);
                    }
                })
                .catch(function () {});

            var oUploader = new FileUploader({
                name: "file",
                uploadUrl: getBaseUrl("api/upload-and-translate"),
                fileType: ["xlsx", "xls"],
                mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel",
                placeholder: "Select an Excel spreadsheet (.xlsx, .xls)...",
                width: "100%"
            });

            var oDialog = new Dialog({
                title: "Mass Translation (Excel Batch)",
                contentWidth: "620px",
                resizable: true,
                draggable: true,
                content: [
                    new VBox({
                        class: "sapUiMediumMargin",
                        items: [
                            new HBox({
                                justifyContent: "SpaceBetween",
                                alignItems: "Center",
                                items: [
                                    new Label({ text: "Excel File:", required: true }),
                                    new Button({
                                        text: "Download Template (.xlsx)",
                                        icon: "sap-icon://download",
                                        type: "Transparent",
                                        press: function () {
                                            var a = document.createElement("a");
                                            a.href = getBaseUrl("api/download-template-excel");
                                            a.download = "translation_template.xlsx";
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                        }
                                    })
                                ]
                            }),
                            oUploader,

                            new Label({ text: "Target Languages (Multi-Select):", required: true, class: "sapUiSmallMarginTop" }),
                            new MultiComboBox({
                                width: "100%",
                                selectedKeys: "{dialog>/targetLanguages}",
                                items: {
                                    path: "dialog>/languages",
                                    template: new Item({ key: "{dialog>code}", text: "{dialog>text}" })
                                }
                            }),

                            new Label({ text: "Evaluator / Tested By:", required: true, class: "sapUiSmallMarginTop" }),
                            new Input({
                                value: "{dialog>/testedBy}",
                                placeholder: "Enter evaluator name"
                            }),

                            new Text({
                                text: "{dialog>/statusText}",
                                class: "sapUiSmallMarginTop"
                            })
                        ]
                    })
                ],
                beginButton: new Button({
                    text: "Start Batch Translation",
                    type: "Emphasized",
                    icon: "sap-icon://upload",
                    press: function () {
                        var oDomRef = oUploader.getDomRef();
                        var oFileInput = oDomRef ? oDomRef.querySelector("input[type=file]") : null;
                        var oFile = oFileInput && oFileInput.files && oFileInput.files[0];

                        if (!oFile) {
                            MessageToast.show("Please select an Excel file to upload.");
                            return;
                        }

                        var aTargets = oModel.getProperty("/targetLanguages");
                        if (!aTargets || aTargets.length === 0) {
                            MessageToast.show("Please select at least one target language.");
                            return;
                        }

                        var sTester = oModel.getProperty("/testedBy");
                        if (!sTester || !sTester.trim()) {
                            MessageToast.show("Please enter evaluator name.");
                            return;
                        }

                        oDialog.setBusy(true);
                        oModel.setProperty("/statusText", "Uploading and translating batch with Google Cloud...");

                        var formData = new FormData();
                        formData.append("file", oFile);
                        formData.append("target_languages", JSON.stringify(aTargets));
                        formData.append("tested_by", sTester.trim());

                        fetch(getBaseUrl("api/upload-and-translate"), {
                            method: "POST",
                            body: formData
                        })
                        .then(function (res) { return res.json(); })
                        .then(function (result) {
                            oDialog.setBusy(false);
                            if (result.success) {
                                oDialog.close();
                                oDialog.destroy();
                                MessageBox.success(
                                    "Mass Translation Completed!\n\n" +
                                    "Total Rows Processed: " + (result.statistics ? result.statistics.totalRows : "N/A") + "\n" +
                                    "Successful: " + (result.statistics ? result.statistics.successful : "N/A") + "\n" +
                                    "Success Rate: " + (result.statistics ? result.statistics.successRate + "%" : "N/A") + "\n" +
                                    "Session ID: " + (result.sessionId || "N/A"),
                                    {
                                        title: "Batch Translation Summary",
                                        onClose: function () {
                                            if (oView && oView.getModel()) {
                                                oView.getModel().refresh();
                                            }
                                        }
                                    }
                                );
                            } else {
                                MessageBox.error(result.error || "Batch translation failed.");
                            }
                        })
                        .catch(function (err) {
                            oDialog.setBusy(false);
                            MessageBox.error("Upload error: " + err.message);
                        });
                    }
                }),
                endButton: new Button({
                    text: "Close",
                    press: function () {
                        oDialog.close();
                        oDialog.destroy();
                    }
                })
            });

            oDialog.setModel(oModel, "dialog");
            oDialog.open();
        }
    };
});

