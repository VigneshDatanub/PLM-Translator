/**
 * @ui5ignore
 */
/* ui5plugin-linter-disable */
/* eslint-disable */
//@ui5-bundle plm/translator/app/Component-preload.js
sap.ui.require.preload({
    "plm/translator/app/Component.js": function () {
// =============================================================
// PLM Translator - SAP Fiori Elements AppComponent (Component.js)
// =============================================================
// 100% Strict SAP Fiori Elements (OData V4) AppComponent
// Extends sap.fe.core.AppComponent and loads standard metadata
// and extensions for the List Report & Object Page floorplan.
// =============================================================

sap.ui.define("plm/translator/app/Component", [
    "sap/fe/core/AppComponent"
], function (AppComponent) {
    "use strict";

    return AppComponent.extend("plm.translator.app.Component", {
        metadata: {
            manifest: "json"
        }
    });
});

    },
    "plm/translator/app/ext/customActions.controller.js": function () {
sap.ui.define("plm/translator/app/ext/customActions.controller", [
    "sap/ui/core/mvc/ControllerExtension",
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
    ControllerExtension,
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

    return ControllerExtension.extend("plm.translator.app.ext.customActions", {
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
    });
});


    },
    "plm/translator/app/ext/customActions.js": function () {
sap.ui.define("plm/translator/app/ext/customActions", [
    "sap/ui/core/mvc/ControllerExtension",
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
    ControllerExtension,
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

    return ControllerExtension.extend("plm.translator.app.ext.customActions", {
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
    });
});


    },
    "plm/translator/app/manifest.json": "{\n    \"_version\": \"1.65.0\",\n    \"sap.app\": {\n        \"id\": \"plm.translator.app\",\n        \"type\": \"application\",\n        \"title\": \"PLM Translation Workbench\",\n        \"description\": \"PLM Translation Tool powered by Google Cloud Translation API and SAP Fiori Elements\",\n        \"applicationVersion\": {\n            \"version\": \"1.0.0\"\n        },\n        \"crossNavigation\": {\n            \"inbounds\": {\n                \"PLMTranslator-manage\": {\n                    \"semanticObject\": \"PLMTranslator\",\n                    \"action\": \"manage\",\n                    \"title\": \"PLM Translator\",\n                    \"subTitle\": \"Google Cloud Translation Tool\",\n                    \"icon\": \"sap-icon://translate\",\n                    \"signature\": {\n                        \"parameters\": {},\n                        \"additionalParameters\": \"allowed\"\n                    }\n                }\n            }\n        },\n        \"dataSources\": {\n            \"mainService\": {\n                \"uri\": \"api/\",\n                \"type\": \"OData\",\n                \"settings\": {\n                    \"odataVersion\": \"4.0\"\n                }\n            }\n        }\n    },\n    \"sap.cloud\": {\n        \"public\": true,\n        \"service\": \"plmtranslator\"\n    },\n    \"sap.ui\": {\n        \"technology\": \"UI5\",\n        \"icons\": {\n            \"icon\": \"sap-icon://translate\"\n        },\n        \"deviceTypes\": {\n            \"desktop\": true,\n            \"tablet\": true,\n            \"phone\": true\n        }\n    },\n    \"sap.ui5\": {\n        \"dependencies\": {\n            \"minUI5Version\": \"1.120.0\",\n            \"libs\": {\n                \"sap.m\": {},\n                \"sap.ui.core\": {},\n                \"sap.ushell\": {},\n                \"sap.fe.core\": {},\n                \"sap.fe.templates\": {},\n                \"sap.ui.unified\": {}\n            }\n        },\n        \"contentDensities\": {\n            \"compact\": true,\n            \"cozy\": true\n        },\n        \"models\": {\n            \"\": {\n                \"dataSource\": \"mainService\",\n                \"preload\": true,\n                \"settings\": {\n                    \"synchronizationMode\": \"None\",\n                    \"operationMode\": \"Server\",\n                    \"autoExpandSelect\": true,\n                    \"earlyRequests\": true\n                }\n            }\n        },\n        \"extends\": {\n            \"extensions\": {\n                \"sap.ui.controllerExtensions\": {\n                    \"sap.fe.templates.ListReport.ListReportController\": {\n                        \"controllerName\": \"plm.translator.app.ext.customActions\"\n                    }\n                }\n            }\n        },\n        \"routing\": {\n            \"config\": {\n                \"routerClass\": \"sap.f.routing.Router\"\n            },\n            \"routes\": [\n                {\n                    \"pattern\": \":?query:\",\n                    \"name\": \"TestResultsList\",\n                    \"target\": \"TestResultsList\"\n                },\n                {\n                    \"pattern\": \"TestResults({key}):?query:\",\n                    \"name\": \"TestResultsObjectPage\",\n                    \"target\": \"TestResultsObjectPage\"\n                }\n            ],\n            \"targets\": {\n                \"TestResultsList\": {\n                    \"type\": \"Component\",\n                    \"id\": \"TestResultsList\",\n                    \"name\": \"sap.fe.templates.ListReport\",\n                    \"options\": {\n                        \"settings\": {\n                            \"contextPath\": \"/TestResults\",\n                            \"variantManagement\": \"Page\",\n                            \"initialLoad\": \"Enabled\",\n                            \"controlConfiguration\": {\n                                \"@com.sap.vocabularies.UI.v1.LineItem\": {\n                                    \"tableSettings\": {\n                                        \"type\": \"ResponsiveTable\"\n                                    },\n                                    \"actions\": {\n                                        \"QuickTranslateAction\": {\n                                            \"press\": \".extension.plm.translator.app.ext.customActions.onQuickTranslate\",\n                                            \"visible\": true,\n                                            \"text\": \"Quick Translate\"\n                                        },\n                                        \"MassUploadAction\": {\n                                            \"press\": \".extension.plm.translator.app.ext.customActions.onMassUpload\",\n                                            \"visible\": true,\n                                            \"text\": \"Mass Translation (Excel)\"\n                                        }\n                                    }\n                                }\n                            }\n                        }\n                    }\n                },\n                \"TestResultsObjectPage\": {\n                    \"type\": \"Component\",\n                    \"id\": \"TestResultsObjectPage\",\n                    \"name\": \"sap.fe.templates.ObjectPage\",\n                    \"options\": {\n                        \"settings\": {\n                            \"contextPath\": \"/TestResults\"\n                        }\n                    }\n                }\n            }\n        }\n    }\n}\n",
    "plm/translator/app/model/languages.json": "[\r\n  {\r\n    \"key\": \"ab\",\r\n    \"code\": \"ab\",\r\n    \"name\": \"Abkhaz\",\r\n    \"text\": \"Abkhaz (ab)\"\r\n  },\r\n  {\r\n    \"key\": \"ace\",\r\n    \"code\": \"ace\",\r\n    \"name\": \"Acehnese\",\r\n    \"text\": \"Acehnese (ace)\"\r\n  },\r\n  {\r\n    \"key\": \"ach\",\r\n    \"code\": \"ach\",\r\n    \"name\": \"Acholi\",\r\n    \"text\": \"Acholi (ach)\"\r\n  },\r\n  {\r\n    \"key\": \"af\",\r\n    \"code\": \"af\",\r\n    \"name\": \"Afrikaans\",\r\n    \"text\": \"Afrikaans (af)\"\r\n  },\r\n  {\r\n    \"key\": \"sq\",\r\n    \"code\": \"sq\",\r\n    \"name\": \"Albanian\",\r\n    \"text\": \"Albanian (sq)\"\r\n  },\r\n  {\r\n    \"key\": \"alz\",\r\n    \"code\": \"alz\",\r\n    \"name\": \"Alur\",\r\n    \"text\": \"Alur (alz)\"\r\n  },\r\n  {\r\n    \"key\": \"am\",\r\n    \"code\": \"am\",\r\n    \"name\": \"Amharic\",\r\n    \"text\": \"Amharic (am)\"\r\n  },\r\n  {\r\n    \"key\": \"ar\",\r\n    \"code\": \"ar\",\r\n    \"name\": \"Arabic\",\r\n    \"text\": \"Arabic (ar)\"\r\n  },\r\n  {\r\n    \"key\": \"hy\",\r\n    \"code\": \"hy\",\r\n    \"name\": \"Armenian\",\r\n    \"text\": \"Armenian (hy)\"\r\n  },\r\n  {\r\n    \"key\": \"as\",\r\n    \"code\": \"as\",\r\n    \"name\": \"Assamese\",\r\n    \"text\": \"Assamese (as)\"\r\n  },\r\n  {\r\n    \"key\": \"awa\",\r\n    \"code\": \"awa\",\r\n    \"name\": \"Awadhi\",\r\n    \"text\": \"Awadhi (awa)\"\r\n  },\r\n  {\r\n    \"key\": \"ay\",\r\n    \"code\": \"ay\",\r\n    \"name\": \"Aymara\",\r\n    \"text\": \"Aymara (ay)\"\r\n  },\r\n  {\r\n    \"key\": \"az\",\r\n    \"code\": \"az\",\r\n    \"name\": \"Azerbaijani\",\r\n    \"text\": \"Azerbaijani (az)\"\r\n  },\r\n  {\r\n    \"key\": \"ban\",\r\n    \"code\": \"ban\",\r\n    \"name\": \"Balinese\",\r\n    \"text\": \"Balinese (ban)\"\r\n  },\r\n  {\r\n    \"key\": \"bm\",\r\n    \"code\": \"bm\",\r\n    \"name\": \"Bambara\",\r\n    \"text\": \"Bambara (bm)\"\r\n  },\r\n  {\r\n    \"key\": \"ba\",\r\n    \"code\": \"ba\",\r\n    \"name\": \"Bashkir\",\r\n    \"text\": \"Bashkir (ba)\"\r\n  },\r\n  {\r\n    \"key\": \"eu\",\r\n    \"code\": \"eu\",\r\n    \"name\": \"Basque\",\r\n    \"text\": \"Basque (eu)\"\r\n  },\r\n  {\r\n    \"key\": \"btx\",\r\n    \"code\": \"btx\",\r\n    \"name\": \"Batak Karo\",\r\n    \"text\": \"Batak Karo (btx)\"\r\n  },\r\n  {\r\n    \"key\": \"bts\",\r\n    \"code\": \"bts\",\r\n    \"name\": \"Batak Simalungun\",\r\n    \"text\": \"Batak Simalungun (bts)\"\r\n  },\r\n  {\r\n    \"key\": \"bbc\",\r\n    \"code\": \"bbc\",\r\n    \"name\": \"Batak Toba\",\r\n    \"text\": \"Batak Toba (bbc)\"\r\n  },\r\n  {\r\n    \"key\": \"be\",\r\n    \"code\": \"be\",\r\n    \"name\": \"Belarusian\",\r\n    \"text\": \"Belarusian (be)\"\r\n  },\r\n  {\r\n    \"key\": \"bem\",\r\n    \"code\": \"bem\",\r\n    \"name\": \"Bemba\",\r\n    \"text\": \"Bemba (bem)\"\r\n  },\r\n  {\r\n    \"key\": \"bn\",\r\n    \"code\": \"bn\",\r\n    \"name\": \"Bengali\",\r\n    \"text\": \"Bengali (bn)\"\r\n  },\r\n  {\r\n    \"key\": \"bew\",\r\n    \"code\": \"bew\",\r\n    \"name\": \"Betawi\",\r\n    \"text\": \"Betawi (bew)\"\r\n  },\r\n  {\r\n    \"key\": \"bho\",\r\n    \"code\": \"bho\",\r\n    \"name\": \"Bhojpuri\",\r\n    \"text\": \"Bhojpuri (bho)\"\r\n  },\r\n  {\r\n    \"key\": \"bik\",\r\n    \"code\": \"bik\",\r\n    \"name\": \"Bikol\",\r\n    \"text\": \"Bikol (bik)\"\r\n  },\r\n  {\r\n    \"key\": \"bs\",\r\n    \"code\": \"bs\",\r\n    \"name\": \"Bosnian\",\r\n    \"text\": \"Bosnian (bs)\"\r\n  },\r\n  {\r\n    \"key\": \"br\",\r\n    \"code\": \"br\",\r\n    \"name\": \"Breton\",\r\n    \"text\": \"Breton (br)\"\r\n  },\r\n  {\r\n    \"key\": \"bg\",\r\n    \"code\": \"bg\",\r\n    \"name\": \"Bulgarian\",\r\n    \"text\": \"Bulgarian (bg)\"\r\n  },\r\n  {\r\n    \"key\": \"bua\",\r\n    \"code\": \"bua\",\r\n    \"name\": \"Buryat\",\r\n    \"text\": \"Buryat (bua)\"\r\n  },\r\n  {\r\n    \"key\": \"yue\",\r\n    \"code\": \"yue\",\r\n    \"name\": \"Cantonese\",\r\n    \"text\": \"Cantonese (yue)\"\r\n  },\r\n  {\r\n    \"key\": \"ca\",\r\n    \"code\": \"ca\",\r\n    \"name\": \"Catalan\",\r\n    \"text\": \"Catalan (ca)\"\r\n  },\r\n  {\r\n    \"key\": \"ceb\",\r\n    \"code\": \"ceb\",\r\n    \"name\": \"Cebuano\",\r\n    \"text\": \"Cebuano (ceb)\"\r\n  },\r\n  {\r\n    \"key\": \"ny\",\r\n    \"code\": \"ny\",\r\n    \"name\": \"Chichewa\",\r\n    \"text\": \"Chichewa (ny)\"\r\n  },\r\n  {\r\n    \"key\": \"zh\",\r\n    \"code\": \"zh\",\r\n    \"name\": \"Chinese (Simplified)\",\r\n    \"text\": \"Chinese (Simplified) (zh)\"\r\n  },\r\n  {\r\n    \"key\": \"zh-CN\",\r\n    \"code\": \"zh-CN\",\r\n    \"name\": \"Chinese (Simplified)\",\r\n    \"text\": \"Chinese (Simplified) (zh-CN)\"\r\n  },\r\n  {\r\n    \"key\": \"zh-TW\",\r\n    \"code\": \"zh-TW\",\r\n    \"name\": \"Chinese (Traditional)\",\r\n    \"text\": \"Chinese (Traditional) (zh-TW)\"\r\n  },\r\n  {\r\n    \"key\": \"cv\",\r\n    \"code\": \"cv\",\r\n    \"name\": \"Chuvash\",\r\n    \"text\": \"Chuvash (cv)\"\r\n  },\r\n  {\r\n    \"key\": \"co\",\r\n    \"code\": \"co\",\r\n    \"name\": \"Corsican\",\r\n    \"text\": \"Corsican (co)\"\r\n  },\r\n  {\r\n    \"key\": \"crh\",\r\n    \"code\": \"crh\",\r\n    \"name\": \"Crimean Tatar\",\r\n    \"text\": \"Crimean Tatar (crh)\"\r\n  },\r\n  {\r\n    \"key\": \"hr\",\r\n    \"code\": \"hr\",\r\n    \"name\": \"Croatian\",\r\n    \"text\": \"Croatian (hr)\"\r\n  },\r\n  {\r\n    \"key\": \"cs\",\r\n    \"code\": \"cs\",\r\n    \"name\": \"Czech\",\r\n    \"text\": \"Czech (cs)\"\r\n  },\r\n  {\r\n    \"key\": \"da\",\r\n    \"code\": \"da\",\r\n    \"name\": \"Danish\",\r\n    \"text\": \"Danish (da)\"\r\n  },\r\n  {\r\n    \"key\": \"dv\",\r\n    \"code\": \"dv\",\r\n    \"name\": \"Dhivehi\",\r\n    \"text\": \"Dhivehi (dv)\"\r\n  },\r\n  {\r\n    \"key\": \"din\",\r\n    \"code\": \"din\",\r\n    \"name\": \"Dinka\",\r\n    \"text\": \"Dinka (din)\"\r\n  },\r\n  {\r\n    \"key\": \"doi\",\r\n    \"code\": \"doi\",\r\n    \"name\": \"Dogri\",\r\n    \"text\": \"Dogri (doi)\"\r\n  },\r\n  {\r\n    \"key\": \"dov\",\r\n    \"code\": \"dov\",\r\n    \"name\": \"Dombe\",\r\n    \"text\": \"Dombe (dov)\"\r\n  },\r\n  {\r\n    \"key\": \"nl\",\r\n    \"code\": \"nl\",\r\n    \"name\": \"Dutch\",\r\n    \"text\": \"Dutch (nl)\"\r\n  },\r\n  {\r\n    \"key\": \"dz\",\r\n    \"code\": \"dz\",\r\n    \"name\": \"Dzongkha\",\r\n    \"text\": \"Dzongkha (dz)\"\r\n  },\r\n  {\r\n    \"key\": \"en\",\r\n    \"code\": \"en\",\r\n    \"name\": \"English\",\r\n    \"text\": \"English (en)\"\r\n  },\r\n  {\r\n    \"key\": \"eo\",\r\n    \"code\": \"eo\",\r\n    \"name\": \"Esperanto\",\r\n    \"text\": \"Esperanto (eo)\"\r\n  },\r\n  {\r\n    \"key\": \"et\",\r\n    \"code\": \"et\",\r\n    \"name\": \"Estonian\",\r\n    \"text\": \"Estonian (et)\"\r\n  },\r\n  {\r\n    \"key\": \"ee\",\r\n    \"code\": \"ee\",\r\n    \"name\": \"Ewe\",\r\n    \"text\": \"Ewe (ee)\"\r\n  },\r\n  {\r\n    \"key\": \"fj\",\r\n    \"code\": \"fj\",\r\n    \"name\": \"Fijian\",\r\n    \"text\": \"Fijian (fj)\"\r\n  },\r\n  {\r\n    \"key\": \"tl\",\r\n    \"code\": \"tl\",\r\n    \"name\": \"Filipino\",\r\n    \"text\": \"Filipino (tl)\"\r\n  },\r\n  {\r\n    \"key\": \"fi\",\r\n    \"code\": \"fi\",\r\n    \"name\": \"Finnish\",\r\n    \"text\": \"Finnish (fi)\"\r\n  },\r\n  {\r\n    \"key\": \"fr\",\r\n    \"code\": \"fr\",\r\n    \"name\": \"French\",\r\n    \"text\": \"French (fr)\"\r\n  },\r\n  {\r\n    \"key\": \"fr-CA\",\r\n    \"code\": \"fr-CA\",\r\n    \"name\": \"French (Canada)\",\r\n    \"text\": \"French (Canada) (fr-CA)\"\r\n  },\r\n  {\r\n    \"key\": \"fy\",\r\n    \"code\": \"fy\",\r\n    \"name\": \"Frisian\",\r\n    \"text\": \"Frisian (fy)\"\r\n  },\r\n  {\r\n    \"key\": \"ff\",\r\n    \"code\": \"ff\",\r\n    \"name\": \"Fulani\",\r\n    \"text\": \"Fulani (ff)\"\r\n  },\r\n  {\r\n    \"key\": \"gaa\",\r\n    \"code\": \"gaa\",\r\n    \"name\": \"Ga\",\r\n    \"text\": \"Ga (gaa)\"\r\n  },\r\n  {\r\n    \"key\": \"gl\",\r\n    \"code\": \"gl\",\r\n    \"name\": \"Galician\",\r\n    \"text\": \"Galician (gl)\"\r\n  },\r\n  {\r\n    \"key\": \"ka\",\r\n    \"code\": \"ka\",\r\n    \"name\": \"Georgian\",\r\n    \"text\": \"Georgian (ka)\"\r\n  },\r\n  {\r\n    \"key\": \"de\",\r\n    \"code\": \"de\",\r\n    \"name\": \"German\",\r\n    \"text\": \"German (de)\"\r\n  },\r\n  {\r\n    \"key\": \"el\",\r\n    \"code\": \"el\",\r\n    \"name\": \"Greek\",\r\n    \"text\": \"Greek (el)\"\r\n  },\r\n  {\r\n    \"key\": \"gn\",\r\n    \"code\": \"gn\",\r\n    \"name\": \"Guarani\",\r\n    \"text\": \"Guarani (gn)\"\r\n  },\r\n  {\r\n    \"key\": \"gu\",\r\n    \"code\": \"gu\",\r\n    \"name\": \"Gujarati\",\r\n    \"text\": \"Gujarati (gu)\"\r\n  },\r\n  {\r\n    \"key\": \"ht\",\r\n    \"code\": \"ht\",\r\n    \"name\": \"Haitian Creole\",\r\n    \"text\": \"Haitian Creole (ht)\"\r\n  },\r\n  {\r\n    \"key\": \"cnh\",\r\n    \"code\": \"cnh\",\r\n    \"name\": \"Hakha Chin\",\r\n    \"text\": \"Hakha Chin (cnh)\"\r\n  },\r\n  {\r\n    \"key\": \"ha\",\r\n    \"code\": \"ha\",\r\n    \"name\": \"Hausa\",\r\n    \"text\": \"Hausa (ha)\"\r\n  },\r\n  {\r\n    \"key\": \"haw\",\r\n    \"code\": \"haw\",\r\n    \"name\": \"Hawaiian\",\r\n    \"text\": \"Hawaiian (haw)\"\r\n  },\r\n  {\r\n    \"key\": \"iw\",\r\n    \"code\": \"iw\",\r\n    \"name\": \"Hebrew\",\r\n    \"text\": \"Hebrew (iw)\"\r\n  },\r\n  {\r\n    \"key\": \"he\",\r\n    \"code\": \"he\",\r\n    \"name\": \"Hebrew\",\r\n    \"text\": \"Hebrew (he)\"\r\n  },\r\n  {\r\n    \"key\": \"hil\",\r\n    \"code\": \"hil\",\r\n    \"name\": \"Hiligaynon\",\r\n    \"text\": \"Hiligaynon (hil)\"\r\n  },\r\n  {\r\n    \"key\": \"hi\",\r\n    \"code\": \"hi\",\r\n    \"name\": \"Hindi\",\r\n    \"text\": \"Hindi (hi)\"\r\n  },\r\n  {\r\n    \"key\": \"hmn\",\r\n    \"code\": \"hmn\",\r\n    \"name\": \"Hmong\",\r\n    \"text\": \"Hmong (hmn)\"\r\n  },\r\n  {\r\n    \"key\": \"hu\",\r\n    \"code\": \"hu\",\r\n    \"name\": \"Hungarian\",\r\n    \"text\": \"Hungarian (hu)\"\r\n  },\r\n  {\r\n    \"key\": \"hrx\",\r\n    \"code\": \"hrx\",\r\n    \"name\": \"Hunsrik\",\r\n    \"text\": \"Hunsrik (hrx)\"\r\n  },\r\n  {\r\n    \"key\": \"is\",\r\n    \"code\": \"is\",\r\n    \"name\": \"Icelandic\",\r\n    \"text\": \"Icelandic (is)\"\r\n  },\r\n  {\r\n    \"key\": \"ig\",\r\n    \"code\": \"ig\",\r\n    \"name\": \"Igbo\",\r\n    \"text\": \"Igbo (ig)\"\r\n  },\r\n  {\r\n    \"key\": \"ilo\",\r\n    \"code\": \"ilo\",\r\n    \"name\": \"Ilocano\",\r\n    \"text\": \"Ilocano (ilo)\"\r\n  },\r\n  {\r\n    \"key\": \"id\",\r\n    \"code\": \"id\",\r\n    \"name\": \"Indonesian\",\r\n    \"text\": \"Indonesian (id)\"\r\n  },\r\n  {\r\n    \"key\": \"ga\",\r\n    \"code\": \"ga\",\r\n    \"name\": \"Irish\",\r\n    \"text\": \"Irish (ga)\"\r\n  },\r\n  {\r\n    \"key\": \"it\",\r\n    \"code\": \"it\",\r\n    \"name\": \"Italian\",\r\n    \"text\": \"Italian (it)\"\r\n  },\r\n  {\r\n    \"key\": \"ja\",\r\n    \"code\": \"ja\",\r\n    \"name\": \"Japanese\",\r\n    \"text\": \"Japanese (ja)\"\r\n  },\r\n  {\r\n    \"key\": \"jw\",\r\n    \"code\": \"jw\",\r\n    \"name\": \"Javanese\",\r\n    \"text\": \"Javanese (jw)\"\r\n  },\r\n  {\r\n    \"key\": \"jv\",\r\n    \"code\": \"jv\",\r\n    \"name\": \"Javanese\",\r\n    \"text\": \"Javanese (jv)\"\r\n  },\r\n  {\r\n    \"key\": \"kn\",\r\n    \"code\": \"kn\",\r\n    \"name\": \"Kannada\",\r\n    \"text\": \"Kannada (kn)\"\r\n  },\r\n  {\r\n    \"key\": \"pam\",\r\n    \"code\": \"pam\",\r\n    \"name\": \"Kapampangan\",\r\n    \"text\": \"Kapampangan (pam)\"\r\n  },\r\n  {\r\n    \"key\": \"kk\",\r\n    \"code\": \"kk\",\r\n    \"name\": \"Kazakh\",\r\n    \"text\": \"Kazakh (kk)\"\r\n  },\r\n  {\r\n    \"key\": \"km\",\r\n    \"code\": \"km\",\r\n    \"name\": \"Khmer\",\r\n    \"text\": \"Khmer (km)\"\r\n  },\r\n  {\r\n    \"key\": \"cgg\",\r\n    \"code\": \"cgg\",\r\n    \"name\": \"Kiga\",\r\n    \"text\": \"Kiga (cgg)\"\r\n  },\r\n  {\r\n    \"key\": \"rw\",\r\n    \"code\": \"rw\",\r\n    \"name\": \"Kinyarwanda\",\r\n    \"text\": \"Kinyarwanda (rw)\"\r\n  },\r\n  {\r\n    \"key\": \"ktu\",\r\n    \"code\": \"ktu\",\r\n    \"name\": \"Kituba\",\r\n    \"text\": \"Kituba (ktu)\"\r\n  },\r\n  {\r\n    \"key\": \"gom\",\r\n    \"code\": \"gom\",\r\n    \"name\": \"Konkani\",\r\n    \"text\": \"Konkani (gom)\"\r\n  },\r\n  {\r\n    \"key\": \"ko\",\r\n    \"code\": \"ko\",\r\n    \"name\": \"Korean\",\r\n    \"text\": \"Korean (ko)\"\r\n  },\r\n  {\r\n    \"key\": \"kri\",\r\n    \"code\": \"kri\",\r\n    \"name\": \"Krio\",\r\n    \"text\": \"Krio (kri)\"\r\n  },\r\n  {\r\n    \"key\": \"ku\",\r\n    \"code\": \"ku\",\r\n    \"name\": \"Kurdish (Kurmanji)\",\r\n    \"text\": \"Kurdish (Kurmanji) (ku)\"\r\n  },\r\n  {\r\n    \"key\": \"ckb\",\r\n    \"code\": \"ckb\",\r\n    \"name\": \"Kurdish (Sorani)\",\r\n    \"text\": \"Kurdish (Sorani) (ckb)\"\r\n  },\r\n  {\r\n    \"key\": \"ky\",\r\n    \"code\": \"ky\",\r\n    \"name\": \"Kyrgyz\",\r\n    \"text\": \"Kyrgyz (ky)\"\r\n  },\r\n  {\r\n    \"key\": \"lo\",\r\n    \"code\": \"lo\",\r\n    \"name\": \"Lao\",\r\n    \"text\": \"Lao (lo)\"\r\n  },\r\n  {\r\n    \"key\": \"ltg\",\r\n    \"code\": \"ltg\",\r\n    \"name\": \"Latgalian\",\r\n    \"text\": \"Latgalian (ltg)\"\r\n  },\r\n  {\r\n    \"key\": \"la\",\r\n    \"code\": \"la\",\r\n    \"name\": \"Latin\",\r\n    \"text\": \"Latin (la)\"\r\n  },\r\n  {\r\n    \"key\": \"lv\",\r\n    \"code\": \"lv\",\r\n    \"name\": \"Latvian\",\r\n    \"text\": \"Latvian (lv)\"\r\n  },\r\n  {\r\n    \"key\": \"lij\",\r\n    \"code\": \"lij\",\r\n    \"name\": \"Ligurian\",\r\n    \"text\": \"Ligurian (lij)\"\r\n  },\r\n  {\r\n    \"key\": \"li\",\r\n    \"code\": \"li\",\r\n    \"name\": \"Limburgish\",\r\n    \"text\": \"Limburgish (li)\"\r\n  },\r\n  {\r\n    \"key\": \"ln\",\r\n    \"code\": \"ln\",\r\n    \"name\": \"Lingala\",\r\n    \"text\": \"Lingala (ln)\"\r\n  },\r\n  {\r\n    \"key\": \"lt\",\r\n    \"code\": \"lt\",\r\n    \"name\": \"Lithuanian\",\r\n    \"text\": \"Lithuanian (lt)\"\r\n  },\r\n  {\r\n    \"key\": \"lmo\",\r\n    \"code\": \"lmo\",\r\n    \"name\": \"Lombard\",\r\n    \"text\": \"Lombard (lmo)\"\r\n  },\r\n  {\r\n    \"key\": \"lg\",\r\n    \"code\": \"lg\",\r\n    \"name\": \"Luganda\",\r\n    \"text\": \"Luganda (lg)\"\r\n  },\r\n  {\r\n    \"key\": \"luo\",\r\n    \"code\": \"luo\",\r\n    \"name\": \"Luo\",\r\n    \"text\": \"Luo (luo)\"\r\n  },\r\n  {\r\n    \"key\": \"lb\",\r\n    \"code\": \"lb\",\r\n    \"name\": \"Luxembourgish\",\r\n    \"text\": \"Luxembourgish (lb)\"\r\n  },\r\n  {\r\n    \"key\": \"mk\",\r\n    \"code\": \"mk\",\r\n    \"name\": \"Macedonian\",\r\n    \"text\": \"Macedonian (mk)\"\r\n  },\r\n  {\r\n    \"key\": \"mai\",\r\n    \"code\": \"mai\",\r\n    \"name\": \"Maithili\",\r\n    \"text\": \"Maithili (mai)\"\r\n  },\r\n  {\r\n    \"key\": \"mak\",\r\n    \"code\": \"mak\",\r\n    \"name\": \"Makassar\",\r\n    \"text\": \"Makassar (mak)\"\r\n  },\r\n  {\r\n    \"key\": \"mg\",\r\n    \"code\": \"mg\",\r\n    \"name\": \"Malagasy\",\r\n    \"text\": \"Malagasy (mg)\"\r\n  },\r\n  {\r\n    \"key\": \"ms\",\r\n    \"code\": \"ms\",\r\n    \"name\": \"Malay\",\r\n    \"text\": \"Malay (ms)\"\r\n  },\r\n  {\r\n    \"key\": \"ms-Arab\",\r\n    \"code\": \"ms-Arab\",\r\n    \"name\": \"Malay (Jawi)\",\r\n    \"text\": \"Malay (Jawi) (ms-Arab)\"\r\n  },\r\n  {\r\n    \"key\": \"ml\",\r\n    \"code\": \"ml\",\r\n    \"name\": \"Malayalam\",\r\n    \"text\": \"Malayalam (ml)\"\r\n  },\r\n  {\r\n    \"key\": \"mt\",\r\n    \"code\": \"mt\",\r\n    \"name\": \"Maltese\",\r\n    \"text\": \"Maltese (mt)\"\r\n  },\r\n  {\r\n    \"key\": \"mi\",\r\n    \"code\": \"mi\",\r\n    \"name\": \"Maori\",\r\n    \"text\": \"Maori (mi)\"\r\n  },\r\n  {\r\n    \"key\": \"mr\",\r\n    \"code\": \"mr\",\r\n    \"name\": \"Marathi\",\r\n    \"text\": \"Marathi (mr)\"\r\n  },\r\n  {\r\n    \"key\": \"chm\",\r\n    \"code\": \"chm\",\r\n    \"name\": \"Meadow Mari\",\r\n    \"text\": \"Meadow Mari (chm)\"\r\n  },\r\n  {\r\n    \"key\": \"mni-Mtei\",\r\n    \"code\": \"mni-Mtei\",\r\n    \"name\": \"Meiteilon (Manipuri)\",\r\n    \"text\": \"Meiteilon (Manipuri) (mni-Mtei)\"\r\n  },\r\n  {\r\n    \"key\": \"min\",\r\n    \"code\": \"min\",\r\n    \"name\": \"Minang\",\r\n    \"text\": \"Minang (min)\"\r\n  },\r\n  {\r\n    \"key\": \"lus\",\r\n    \"code\": \"lus\",\r\n    \"name\": \"Mizo\",\r\n    \"text\": \"Mizo (lus)\"\r\n  },\r\n  {\r\n    \"key\": \"mn\",\r\n    \"code\": \"mn\",\r\n    \"name\": \"Mongolian\",\r\n    \"text\": \"Mongolian (mn)\"\r\n  },\r\n  {\r\n    \"key\": \"my\",\r\n    \"code\": \"my\",\r\n    \"name\": \"Myanmar (Burmese)\",\r\n    \"text\": \"Myanmar (Burmese) (my)\"\r\n  },\r\n  {\r\n    \"key\": \"nr\",\r\n    \"code\": \"nr\",\r\n    \"name\": \"Ndebele (South)\",\r\n    \"text\": \"Ndebele (South) (nr)\"\r\n  },\r\n  {\r\n    \"key\": \"new\",\r\n    \"code\": \"new\",\r\n    \"name\": \"Nepalbhasa (Newari)\",\r\n    \"text\": \"Nepalbhasa (Newari) (new)\"\r\n  },\r\n  {\r\n    \"key\": \"ne\",\r\n    \"code\": \"ne\",\r\n    \"name\": \"Nepali\",\r\n    \"text\": \"Nepali (ne)\"\r\n  },\r\n  {\r\n    \"key\": \"no\",\r\n    \"code\": \"no\",\r\n    \"name\": \"Norwegian\",\r\n    \"text\": \"Norwegian (no)\"\r\n  },\r\n  {\r\n    \"key\": \"nus\",\r\n    \"code\": \"nus\",\r\n    \"name\": \"Nuer\",\r\n    \"text\": \"Nuer (nus)\"\r\n  },\r\n  {\r\n    \"key\": \"oc\",\r\n    \"code\": \"oc\",\r\n    \"name\": \"Occitan\",\r\n    \"text\": \"Occitan (oc)\"\r\n  },\r\n  {\r\n    \"key\": \"or\",\r\n    \"code\": \"or\",\r\n    \"name\": \"Odia (Oriya)\",\r\n    \"text\": \"Odia (Oriya) (or)\"\r\n  },\r\n  {\r\n    \"key\": \"om\",\r\n    \"code\": \"om\",\r\n    \"name\": \"Oromo\",\r\n    \"text\": \"Oromo (om)\"\r\n  },\r\n  {\r\n    \"key\": \"pag\",\r\n    \"code\": \"pag\",\r\n    \"name\": \"Pangasinan\",\r\n    \"text\": \"Pangasinan (pag)\"\r\n  },\r\n  {\r\n    \"key\": \"pap\",\r\n    \"code\": \"pap\",\r\n    \"name\": \"Papiamento\",\r\n    \"text\": \"Papiamento (pap)\"\r\n  },\r\n  {\r\n    \"key\": \"ps\",\r\n    \"code\": \"ps\",\r\n    \"name\": \"Pashto\",\r\n    \"text\": \"Pashto (ps)\"\r\n  },\r\n  {\r\n    \"key\": \"fa\",\r\n    \"code\": \"fa\",\r\n    \"name\": \"Persian\",\r\n    \"text\": \"Persian (fa)\"\r\n  },\r\n  {\r\n    \"key\": \"pl\",\r\n    \"code\": \"pl\",\r\n    \"name\": \"Polish\",\r\n    \"text\": \"Polish (pl)\"\r\n  },\r\n  {\r\n    \"key\": \"pt\",\r\n    \"code\": \"pt\",\r\n    \"name\": \"Portuguese (Brazil)\",\r\n    \"text\": \"Portuguese (Brazil) (pt)\"\r\n  },\r\n  {\r\n    \"key\": \"pt-PT\",\r\n    \"code\": \"pt-PT\",\r\n    \"name\": \"Portuguese (Portugal)\",\r\n    \"text\": \"Portuguese (Portugal) (pt-PT)\"\r\n  },\r\n  {\r\n    \"key\": \"pa\",\r\n    \"code\": \"pa\",\r\n    \"name\": \"Punjabi (Gurmukhi)\",\r\n    \"text\": \"Punjabi (Gurmukhi) (pa)\"\r\n  },\r\n  {\r\n    \"key\": \"pa-Arab\",\r\n    \"code\": \"pa-Arab\",\r\n    \"name\": \"Punjabi (Shahmukhi)\",\r\n    \"text\": \"Punjabi (Shahmukhi) (pa-Arab)\"\r\n  },\r\n  {\r\n    \"key\": \"qu\",\r\n    \"code\": \"qu\",\r\n    \"name\": \"Quechua\",\r\n    \"text\": \"Quechua (qu)\"\r\n  },\r\n  {\r\n    \"key\": \"rom\",\r\n    \"code\": \"rom\",\r\n    \"name\": \"Romani\",\r\n    \"text\": \"Romani (rom)\"\r\n  },\r\n  {\r\n    \"key\": \"ro\",\r\n    \"code\": \"ro\",\r\n    \"name\": \"Romanian\",\r\n    \"text\": \"Romanian (ro)\"\r\n  },\r\n  {\r\n    \"key\": \"rn\",\r\n    \"code\": \"rn\",\r\n    \"name\": \"Rundi\",\r\n    \"text\": \"Rundi (rn)\"\r\n  },\r\n  {\r\n    \"key\": \"ru\",\r\n    \"code\": \"ru\",\r\n    \"name\": \"Russian\",\r\n    \"text\": \"Russian (ru)\"\r\n  },\r\n  {\r\n    \"key\": \"sm\",\r\n    \"code\": \"sm\",\r\n    \"name\": \"Samoan\",\r\n    \"text\": \"Samoan (sm)\"\r\n  },\r\n  {\r\n    \"key\": \"sg\",\r\n    \"code\": \"sg\",\r\n    \"name\": \"Sango\",\r\n    \"text\": \"Sango (sg)\"\r\n  },\r\n  {\r\n    \"key\": \"sa\",\r\n    \"code\": \"sa\",\r\n    \"name\": \"Sanskrit\",\r\n    \"text\": \"Sanskrit (sa)\"\r\n  },\r\n  {\r\n    \"key\": \"gd\",\r\n    \"code\": \"gd\",\r\n    \"name\": \"Scots Gaelic\",\r\n    \"text\": \"Scots Gaelic (gd)\"\r\n  },\r\n  {\r\n    \"key\": \"nso\",\r\n    \"code\": \"nso\",\r\n    \"name\": \"Sepedi\",\r\n    \"text\": \"Sepedi (nso)\"\r\n  },\r\n  {\r\n    \"key\": \"sr\",\r\n    \"code\": \"sr\",\r\n    \"name\": \"Serbian\",\r\n    \"text\": \"Serbian (sr)\"\r\n  },\r\n  {\r\n    \"key\": \"st\",\r\n    \"code\": \"st\",\r\n    \"name\": \"Sesotho\",\r\n    \"text\": \"Sesotho (st)\"\r\n  },\r\n  {\r\n    \"key\": \"crs\",\r\n    \"code\": \"crs\",\r\n    \"name\": \"Seychellois Creole\",\r\n    \"text\": \"Seychellois Creole (crs)\"\r\n  },\r\n  {\r\n    \"key\": \"shn\",\r\n    \"code\": \"shn\",\r\n    \"name\": \"Shan\",\r\n    \"text\": \"Shan (shn)\"\r\n  },\r\n  {\r\n    \"key\": \"sn\",\r\n    \"code\": \"sn\",\r\n    \"name\": \"Shona\",\r\n    \"text\": \"Shona (sn)\"\r\n  },\r\n  {\r\n    \"key\": \"scn\",\r\n    \"code\": \"scn\",\r\n    \"name\": \"Sicilian\",\r\n    \"text\": \"Sicilian (scn)\"\r\n  },\r\n  {\r\n    \"key\": \"szl\",\r\n    \"code\": \"szl\",\r\n    \"name\": \"Silesian\",\r\n    \"text\": \"Silesian (szl)\"\r\n  },\r\n  {\r\n    \"key\": \"sd\",\r\n    \"code\": \"sd\",\r\n    \"name\": \"Sindhi\",\r\n    \"text\": \"Sindhi (sd)\"\r\n  },\r\n  {\r\n    \"key\": \"si\",\r\n    \"code\": \"si\",\r\n    \"name\": \"Sinhala\",\r\n    \"text\": \"Sinhala (si)\"\r\n  },\r\n  {\r\n    \"key\": \"sk\",\r\n    \"code\": \"sk\",\r\n    \"name\": \"Slovak\",\r\n    \"text\": \"Slovak (sk)\"\r\n  },\r\n  {\r\n    \"key\": \"sl\",\r\n    \"code\": \"sl\",\r\n    \"name\": \"Slovenian\",\r\n    \"text\": \"Slovenian (sl)\"\r\n  },\r\n  {\r\n    \"key\": \"so\",\r\n    \"code\": \"so\",\r\n    \"name\": \"Somali\",\r\n    \"text\": \"Somali (so)\"\r\n  },\r\n  {\r\n    \"key\": \"es\",\r\n    \"code\": \"es\",\r\n    \"name\": \"Spanish\",\r\n    \"text\": \"Spanish (es)\"\r\n  },\r\n  {\r\n    \"key\": \"su\",\r\n    \"code\": \"su\",\r\n    \"name\": \"Sundanese\",\r\n    \"text\": \"Sundanese (su)\"\r\n  },\r\n  {\r\n    \"key\": \"sw\",\r\n    \"code\": \"sw\",\r\n    \"name\": \"Swahili\",\r\n    \"text\": \"Swahili (sw)\"\r\n  },\r\n  {\r\n    \"key\": \"ss\",\r\n    \"code\": \"ss\",\r\n    \"name\": \"Swati\",\r\n    \"text\": \"Swati (ss)\"\r\n  },\r\n  {\r\n    \"key\": \"sv\",\r\n    \"code\": \"sv\",\r\n    \"name\": \"Swedish\",\r\n    \"text\": \"Swedish (sv)\"\r\n  },\r\n  {\r\n    \"key\": \"tg\",\r\n    \"code\": \"tg\",\r\n    \"name\": \"Tajik\",\r\n    \"text\": \"Tajik (tg)\"\r\n  },\r\n  {\r\n    \"key\": \"ta\",\r\n    \"code\": \"ta\",\r\n    \"name\": \"Tamil\",\r\n    \"text\": \"Tamil (ta)\"\r\n  },\r\n  {\r\n    \"key\": \"tt\",\r\n    \"code\": \"tt\",\r\n    \"name\": \"Tatar\",\r\n    \"text\": \"Tatar (tt)\"\r\n  },\r\n  {\r\n    \"key\": \"te\",\r\n    \"code\": \"te\",\r\n    \"name\": \"Telugu\",\r\n    \"text\": \"Telugu (te)\"\r\n  },\r\n  {\r\n    \"key\": \"tet\",\r\n    \"code\": \"tet\",\r\n    \"name\": \"Tetum\",\r\n    \"text\": \"Tetum (tet)\"\r\n  },\r\n  {\r\n    \"key\": \"th\",\r\n    \"code\": \"th\",\r\n    \"name\": \"Thai\",\r\n    \"text\": \"Thai (th)\"\r\n  },\r\n  {\r\n    \"key\": \"ti\",\r\n    \"code\": \"ti\",\r\n    \"name\": \"Tigrinya\",\r\n    \"text\": \"Tigrinya (ti)\"\r\n  },\r\n  {\r\n    \"key\": \"ts\",\r\n    \"code\": \"ts\",\r\n    \"name\": \"Tsonga\",\r\n    \"text\": \"Tsonga (ts)\"\r\n  },\r\n  {\r\n    \"key\": \"tn\",\r\n    \"code\": \"tn\",\r\n    \"name\": \"Tswana\",\r\n    \"text\": \"Tswana (tn)\"\r\n  },\r\n  {\r\n    \"key\": \"tr\",\r\n    \"code\": \"tr\",\r\n    \"name\": \"Turkish\",\r\n    \"text\": \"Turkish (tr)\"\r\n  },\r\n  {\r\n    \"key\": \"tk\",\r\n    \"code\": \"tk\",\r\n    \"name\": \"Turkmen\",\r\n    \"text\": \"Turkmen (tk)\"\r\n  },\r\n  {\r\n    \"key\": \"ak\",\r\n    \"code\": \"ak\",\r\n    \"name\": \"Twi\",\r\n    \"text\": \"Twi (ak)\"\r\n  },\r\n  {\r\n    \"key\": \"uk\",\r\n    \"code\": \"uk\",\r\n    \"name\": \"Ukrainian\",\r\n    \"text\": \"Ukrainian (uk)\"\r\n  },\r\n  {\r\n    \"key\": \"ur\",\r\n    \"code\": \"ur\",\r\n    \"name\": \"Urdu\",\r\n    \"text\": \"Urdu (ur)\"\r\n  },\r\n  {\r\n    \"key\": \"ug\",\r\n    \"code\": \"ug\",\r\n    \"name\": \"Uyghur\",\r\n    \"text\": \"Uyghur (ug)\"\r\n  },\r\n  {\r\n    \"key\": \"uz\",\r\n    \"code\": \"uz\",\r\n    \"name\": \"Uzbek\",\r\n    \"text\": \"Uzbek (uz)\"\r\n  },\r\n  {\r\n    \"key\": \"vi\",\r\n    \"code\": \"vi\",\r\n    \"name\": \"Vietnamese\",\r\n    \"text\": \"Vietnamese (vi)\"\r\n  },\r\n  {\r\n    \"key\": \"cy\",\r\n    \"code\": \"cy\",\r\n    \"name\": \"Welsh\",\r\n    \"text\": \"Welsh (cy)\"\r\n  },\r\n  {\r\n    \"key\": \"xh\",\r\n    \"code\": \"xh\",\r\n    \"name\": \"Xhosa\",\r\n    \"text\": \"Xhosa (xh)\"\r\n  },\r\n  {\r\n    \"key\": \"yi\",\r\n    \"code\": \"yi\",\r\n    \"name\": \"Yiddish\",\r\n    \"text\": \"Yiddish (yi)\"\r\n  },\r\n  {\r\n    \"key\": \"yo\",\r\n    \"code\": \"yo\",\r\n    \"name\": \"Yoruba\",\r\n    \"text\": \"Yoruba (yo)\"\r\n  },\r\n  {\r\n    \"key\": \"yua\",\r\n    \"code\": \"yua\",\r\n    \"name\": \"Yucatec Maya\",\r\n    \"text\": \"Yucatec Maya (yua)\"\r\n  },\r\n  {\r\n    \"key\": \"zu\",\r\n    \"code\": \"zu\",\r\n    \"name\": \"Zulu\",\r\n    \"text\": \"Zulu (zu)\"\r\n  }\r\n]"
});
