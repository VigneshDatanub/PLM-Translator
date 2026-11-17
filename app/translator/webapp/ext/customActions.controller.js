sap.ui.define([
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
    "sap/m/Toolbar",
    "sap/m/ToolbarSpacer",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Item",
    "sap/ui/unified/FileUploader",
    "sap/ui/model/json/JSONModel"
], function (
    ControllerExtension,
    Dialog, Button, VBox, HBox, Label, TextArea, Input, Select,
    ComboBox, MultiComboBox, Text, Title, Toolbar, ToolbarSpacer,
    MessageToast, MessageBox, Item, FileUploader, JSONModel
) {
    "use strict";

    function getBaseUrl(sPath) {
        var sClean = sPath.startsWith("/") ? sPath.slice(1) : sPath;
        var sRoot = sap.ui.require.toUrl("plm/translator/app");
        if (sRoot && sRoot !== "." && sRoot !== "./") {
            return sRoot.replace(/\/$/, "") + "/" + sClean;
        }
        return "/" + sClean;
    }

    function applyClass(oControl, sClasses) {
        if (oControl && sClasses) {
            sClasses.split(" ").forEach(function (c) {
                if (c && c.trim()) {
                    oControl.addStyleClass(c.trim());
                }
            });
        }
        return oControl;
    }

    function ensureXLSX() {
        if (typeof window !== "undefined" && window.XLSX && window.XLSX.utils && typeof window.XLSX.read === "function") {
            return Promise.resolve(window.XLSX);
        }

        return new Promise(function (resolve, reject) {
            function checkXLSX() {
                if (typeof window !== "undefined" && window.XLSX && window.XLSX.utils) {
                    resolve(window.XLSX);
                    return true;
                }
                if (typeof sap !== "undefined" && sap.ui && sap.ui.require) {
                    var oMod = sap.ui.require("xlsx") || sap.ui.require("plm/translator/app/libs/xlsx.full.min");
                    if (oMod && oMod.utils) {
                        window.XLSX = oMod;
                        resolve(oMod);
                        return true;
                    }
                }
                return false;
            }

            if (checkXLSX()) {
                return;
            }

            var sScriptId = "plm-xlsx-bundle";
            var existingScript = document.getElementById(sScriptId);
            if (existingScript) {
                var pollCount = 0;
                var pollInterval = setInterval(function () {
                    pollCount++;
                    if (checkXLSX()) {
                        clearInterval(pollInterval);
                    } else if (pollCount > 30) {
                        clearInterval(pollInterval);
                        reject(new Error("Timeout waiting for Excel library to initialize."));
                    }
                }, 100);
                return;
            }

            var sUrl = sap.ui.require.toUrl("plm/translator/app/libs/xlsx.full.min.js");
            var oScript = document.createElement("script");
            oScript.id = sScriptId;
            oScript.type = "text/javascript";

            oScript.onload = function () {
                if (checkXLSX()) {
                    return;
                }
                setTimeout(function () {
                    if (checkXLSX()) {
                        return;
                    }
                    reject(new Error("Excel library script loaded but XLSX object is unavailable."));
                }, 50);
            };

            oScript.onerror = function () {
                console.warn("[PLM Translator] Local xlsx.full.min.js failed to load, falling back to CDN...");
                var oCdn = document.createElement("script");
                oCdn.id = "plm-xlsx-cdn";
                oCdn.type = "text/javascript";
                oCdn.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
                oCdn.onload = function () {
                    if (checkXLSX()) {
                        return;
                    }
                    setTimeout(function () {
                        if (checkXLSX()) {
                            return;
                        }
                        reject(new Error("Excel library loaded from CDN but XLSX object is unavailable."));
                    }, 50);
                };
                oCdn.onerror = function () {
                    reject(new Error("Failed to load Excel library from both local resources and CDN."));
                };
                document.head.appendChild(oCdn);
            };

            oScript.src = sUrl;
            document.head.appendChild(oScript);
        });
    }

    return ControllerExtension.extend("plm.translator.app.ext.customActions", {
        /**
         * @ui5ignore
         * @public
         * Quick Single Translation Action Dialog
         * Allows user to translate via Google Cloud, review/edit the output,
         * adjust accuracy rating, and save to Test Results.
         */
        onQuickTranslate: function (oEvent) {
            var oView = (this.base && this.base.getView) ? this.base.getView() : null;
            var oModel = new JSONModel({
                sourceText: "",
                targetLanguage: "de",
                translatedText: "",
                detectedLanguage: "en",
                detectedLanguageDisplay: "",
                outcome: "Success",
                accuracy: 95,
                observation: "",
                isTranslating: false,
                isTranslated: false,
                languages: []
            });
            oModel.setSizeLimit(1000);

            // 1. Load languages dynamically from Google Cloud Translation API
            fetch(getBaseUrl("api/getLanguages()"))
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    var aLangs = (data && data.value) ? data.value : (Array.isArray(data) ? data : []);
                    oModel.setProperty("/languages", aLangs);
                })
                .catch(function (e) {
                    console.warn("[QuickTranslate] Could not load languages dynamically:", e);
                });

            var oDialog = new Dialog({
                title: "Single Translation",
                customHeader: new Toolbar({
                    content: [
                        applyClass(new Title({ text: "Single Translation", level: "H5" }), "sapUiSmallMarginBegin"),
                        new ToolbarSpacer(),
                        new Button({
                            icon: "sap-icon://decline",
                            type: "Transparent",
                            tooltip: "Close",
                            press: function () {
                                oDialog.close();
                            }
                        })
                    ]
                }),
                contentWidth: "760px",
                resizable: true,
                draggable: true,
                afterClose: function () {
                    oDialog.destroy();
                },
                content: [
                    new VBox({
                        width: "100%",
                        items: [
                            applyClass(new Label({ text: "Source Text to Translate:", required: true }), "sapUiTinyMarginBottom"),
                            new TextArea({
                                width: "100%",
                                rows: 3,
                                value: "{dialog>/sourceText}",
                                placeholder: "Enter source text to translate..."
                            }),

                            applyClass(new Label({ text: "Target Language:", required: true }), "sapUiSmallMarginTop sapUiTinyMarginBottom"),
                            new ComboBox({
                                width: "100%",
                                selectedKey: "{dialog>/targetLanguage}",
                                items: {
                                    path: "dialog>/languages",
                                    length: 1000,
                                    template: new Item({ key: "{dialog>code}", text: "{dialog>text}" })
                                }
                            }),

                            new HBox({
                                justifyContent: "End",
                                items: [
                                    applyClass(new Button({
                                        text: "Translate via Google Cloud",
                                        type: "Emphasized",
                                        icon: "sap-icon://translate",
                                        busy: "{dialog>/isTranslating}",
                                        press: function () {
                                            var sText = oModel.getProperty("/sourceText");
                                            var sLang = oModel.getProperty("/targetLanguage");
                                            if (!sText || !sText.trim()) {
                                                MessageToast.show("Please enter source text to translate.");
                                                return;
                                            }
                                            if (!sLang || !sLang.trim()) {
                                                MessageToast.show("Please select a target language.");
                                                return;
                                            }

                                            oModel.setProperty("/isTranslating", true);
                                            fetch(getBaseUrl("api/translate"), {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ text: sText.trim(), targetLanguage: sLang.trim() })
                                            })
                                            .then(function (res) { return res.json(); })
                                            .then(function (resData) {
                                                oModel.setProperty("/isTranslating", false);
                                                var res = (resData && resData.value) ? resData.value : resData;
                                                if (res && res.success) {
                                                    var sDet = res.sourceLanguage || "en";
                                                    var aLanguages = oModel.getProperty("/languages") || [];
                                                    var sDetName = sDet;
                                                    for (var idx = 0; idx < aLanguages.length; idx++) {
                                                        if (aLanguages[idx].code === sDet || aLanguages[idx].key === sDet) {
                                                            sDetName = aLanguages[idx].text || aLanguages[idx].name || sDet;
                                                            break;
                                                        }
                                                    }

                                                    oModel.setProperty("/translatedText", res.translatedText);
                                                    oModel.setProperty("/detectedLanguage", sDet);
                                                    oModel.setProperty("/detectedLanguageDisplay", sDetName);
                                                    oModel.setProperty("/isTranslated", true);
                                                    if (!oModel.getProperty("/outcome")) {
                                                        oModel.setProperty("/outcome", "Success");
                                                    }
                                                    if (oModel.getProperty("/accuracy") === null || oModel.getProperty("/accuracy") === undefined || oModel.getProperty("/accuracy") === "") {
                                                        oModel.setProperty("/accuracy", 95);
                                                    }
                                                    MessageToast.show("Translation completed! Detected source: " + sDetName);
                                                } else {
                                                    MessageBox.error((res && res.error) || "Translation failed");
                                                }
                                            })
                                            .catch(function (err) {
                                                oModel.setProperty("/isTranslating", false);
                                                MessageBox.error("Network error during translation: " + err.message);
                                            });
                                        }
                                    }), "sapUiTinyMarginTop")
                                ]
                            }),

                            applyClass(new Label({ text: "Translated Result:" }), "sapUiSmallMarginTop sapUiTinyMarginBottom"),
                            new TextArea({
                                width: "100%",
                                rows: 3,
                                editable: true,
                                value: "{dialog>/translatedText}",
                                placeholder: "Translated result will appear here."
                            }),

                            applyClass(new Title({ text: "Record Test Quality & Evaluation", level: "H5" }), "sapUiMediumMarginTop sapUiTinyMarginBottom"),
                            new HBox({
                                width: "100%",
                                justifyContent: "SpaceBetween",
                                items: [
                                    applyClass(new VBox({
                                        width: "48%",
                                        items: [
                                            applyClass(new Label({ text: "Outcome:" }), "sapUiTinyMarginBottom"),
                                            new Select({
                                                width: "100%",
                                                selectedKey: "{dialog>/outcome}",
                                                items: [
                                                    new Item({ key: "Success", text: "Success" }),
                                                    new Item({ key: "Partial", text: "Partial" }),
                                                    new Item({ key: "Failure", text: "Failure" })
                                                ]
                                            })
                                        ]
                                    }), "sapUiSmallMarginEnd"),
                                    new VBox({
                                        width: "48%",
                                        items: [
                                            applyClass(new Label({ text: "Accuracy Rating (0-100%):" }), "sapUiTinyMarginBottom"),
                                            new Input({
                                                width: "100%",
                                                type: "Number",
                                                value: "{dialog>/accuracy}",
                                                placeholder: "95"
                                            })
                                        ]
                                    })
                                ]
                            }),

                            applyClass(new Label({ text: "Observations & Notes:" }), "sapUiSmallMarginTop sapUiTinyMarginBottom"),
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
                        var sSrc = oModel.getProperty("/sourceText");
                        var sTrans = oModel.getProperty("/translatedText");

                        if (!sSrc || !sSrc.trim()) {
                            MessageToast.show("Please enter source text and translate before saving.");
                            return;
                        }
                        if (!sTrans || !sTrans.trim()) {
                            MessageToast.show("Please perform translation or enter translated text before saving.");
                            return;
                        }

                        var accVal = oModel.getProperty("/accuracy");
                        var parsedAcc = (accVal !== null && accVal !== undefined && accVal !== "") ? parseFloat(accVal) : 95;
                        if (isNaN(parsedAcc) || parsedAcc < 0 || parsedAcc > 100) {
                            MessageToast.show("Accuracy rating must be between 0 and 100.");
                            return;
                        }

                        var sTargetLang = oModel.getProperty("/targetLanguage");
                        var aLangs = oModel.getProperty("/languages") || [];
                        var sLangText = sTargetLang;
                        for (var l = 0; l < aLangs.length; l++) {
                            if (aLangs[l].code === sTargetLang) {
                                sLangText = aLangs[l].text || aLangs[l].name || sTargetLang;
                                break;
                            }
                        }

                        oDialog.setBusy(true);
                        var sSessionId = "single_translation_" + new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 15);
                        var sDetectedSource = oModel.getProperty("/detectedLanguage");
                        var payload = {
                            sessionId: sSessionId,
                            sourceText: sSrc.trim(),
                            sourceLanguage: sDetectedSource || "en",
                            targetLanguage: sTargetLang,
                            translatedText: sTrans.trim(),
                            outcome: oModel.getProperty("/outcome") || "Success",
                            accuracy: parsedAcc,
                            observation: (oModel.getProperty("/observation") || "").trim()
                        };

                        fetch(getBaseUrl("api/singleTranslate"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(payload)
                        })
                        .then(function (res) {
                            if (!res.ok) {
                                return res.json().then(function (errData) {
                                    throw new Error((errData.error && errData.error.message) || res.statusText);
                                });
                            }
                            return res.json();
                        })
                        .then(function (saved) {
                            oDialog.setBusy(false);
                            oDialog.close();
                            MessageToast.show("Test evaluation created successfully!");

                            // Refresh current FE view binding if available
                            if (oView && oView.getModel()) {
                                oView.getModel().refresh();
                            }
                            try {
                                var oTable = oView.byId("fe::table::TestResults::LineItem") || oView.byId("fe::table::TestResults::LineItem-innerTable");
                                if (oTable && oTable.getBinding && oTable.getBinding("items")) {
                                    oTable.getBinding("items").refresh();
                                } else if (oTable && oTable.getBinding && oTable.getBinding("rows")) {
                                    oTable.getBinding("rows").refresh();
                                }
                            } catch (refreshErr) {}
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
                    }
                })
            });

            oDialog.addStyleClass("sapUiContentPadding sapUiResponsivePadding");
            oDialog.setModel(oModel, "dialog");
            oDialog.open();
        },

        /**
         * @ui5ignore
         * @public
         * Mass Translation Excel Upload Action Dialog
         */
        onMassUpload: function (oEvent) {
            var oView = (this.base && this.base.getView) ? this.base.getView() : null;
            var oModel = new JSONModel({
                targetLanguages: ["de", "fr", "es"],
                languages: [],
                statusText: ""
            });
            oModel.setSizeLimit(1000);

            // Preload Excel library immediately so it is ready when the user interacts
            ensureXLSX().catch(function (e) {
                console.warn("[MassUpload] Background XLSX preload warning:", e);
            });

            fetch(getBaseUrl("api/getLanguages()"))
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    var aLangs = (data && data.value) ? data.value : (Array.isArray(data) ? data : []);
                    oModel.setProperty("/languages", aLangs);
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

            var oMultiCombo = new MultiComboBox({
                width: "100%",
                selectedKeys: "{dialog>/targetLanguages}",
                items: {
                    path: "dialog>/languages",
                    length: 1000,
                    template: new Item({ key: "{dialog>code}", text: "{dialog>text}" })
                },
                selectionChange: function (oEvent) {
                    var aSelected = oEvent.getSource().getSelectedKeys();
                    oModel.setProperty("/targetLanguages", aSelected);
                },
                selectionFinish: function (oEvent) {
                    var aSelected = oEvent.getSource().getSelectedKeys();
                    oModel.setProperty("/targetLanguages", aSelected);
                }
            });

            var oDialog = new Dialog({
                title: "Mass Translation",
                customHeader: new Toolbar({
                    content: [
                        applyClass(new Title({ text: "Mass Translation", level: "H5" }), "sapUiSmallMarginBegin"),
                        new ToolbarSpacer(),
                        new Button({
                            icon: "sap-icon://decline",
                            type: "Transparent",
                            tooltip: "Close",
                            press: function () {
                                oDialog.close();
                            }
                        })
                    ]
                }),
                contentWidth: "760px",
                resizable: true,
                draggable: true,
                afterClose: function () {
                    oDialog.destroy();
                },
                content: [
                    new VBox({
                        width: "100%",
                        items: [
                            new HBox({
                                width: "100%",
                                justifyContent: "SpaceBetween",
                                alignItems: "Center",
                                items: [
                                    new Label({ text: "Excel File:", required: true }),
                                    new Button({
                                        text: "Download Template (.xlsx)",
                                        icon: "sap-icon://download",
                                        type: "Transparent",
                                        press: function () {
                                            oDialog.setBusy(true);
                                            ensureXLSX().then(function (XLSX) {
                                                oDialog.setBusy(false);
                                                var wb = XLSX.utils.book_new();
                                                var wsData = [
                                                    ["Phrase Text", "Description"],
                                                    ["Welcome to our application", "Header greeting"],
                                                    ["Save Changes", "Button label"],
                                                    ["Error loading data", "Error alert"]
                                                ];
                                                var ws = XLSX.utils.aoa_to_sheet(wsData);
                                                ws["!cols"] = [{ wch: 35 }, { wch: 25 }];
                                                XLSX.utils.book_append_sheet(wb, ws, "Translations");
                                                XLSX.writeFile(wb, "mass_translation_template.xlsx");
                                                MessageToast.show("Template downloaded successfully.");
                                            }).catch(function (err) {
                                                oDialog.setBusy(false);
                                                MessageBox.error("Excel export library is not loaded: " + err.message);
                                            });
                                        }
                                    })
                                ]
                            }),
                            applyClass(oUploader, "sapUiTinyMarginTop"),

                            applyClass(new Label({ text: "Target Languages (Multi-Select):", required: true }), "sapUiSmallMarginTop sapUiTinyMarginBottom"),
                            oMultiCombo,

                            applyClass(new Text({
                                text: "{dialog>/statusText}"
                            }), "sapUiSmallMarginTop")
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

                        var aTargets = oMultiCombo.getSelectedKeys();
                        if (!aTargets || aTargets.length === 0) {
                            aTargets = oModel.getProperty("/targetLanguages");
                        }
                        if (!aTargets || aTargets.length === 0) {
                            MessageToast.show("Please select at least one target language.");
                            return;
                        }

                        oDialog.setBusy(true);
                        oModel.setProperty("/statusText", "Ensuring Excel parser is ready...");

                        ensureXLSX().then(function (XLSX) {
                            oModel.setProperty("/statusText", "Reading and parsing Excel file in browser...");

                            var reader = new FileReader();
                            reader.onload = function (e) {
                                try {
                                    var data = new Uint8Array(e.target.result);
                                    var workbook = XLSX.read(data, { type: "array" });
                                    var sheetName = workbook.SheetNames[0];
                                    if (!sheetName) {
                                        oDialog.setBusy(false);
                                        MessageBox.error("Excel file has no sheets.");
                                        return;
                                    }

                                    var worksheet = workbook.Sheets[sheetName];
                                    var rawData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
                                    if (!rawData || rawData.length === 0) {
                                        oDialog.setBusy(false);
                                        MessageBox.error("Excel file is empty.");
                                        return;
                                    }

                                    var columns = Object.keys(rawData[0]);
                                    var possibleTextColumns = [
                                        "Phrase Text", "phrase text", "PHRASE TEXT",
                                        "text", "Text", "TEXT",
                                        "content", "Content", "CONTENT",
                                        "message", "Message", "MESSAGE"
                                    ];
                                    var textCol = null;
                                    for (var i = 0; i < possibleTextColumns.length; i++) {
                                        if (columns.indexOf(possibleTextColumns[i]) !== -1) {
                                            textCol = possibleTextColumns[i];
                                            break;
                                        }
                                    }
                                    if (!textCol) {
                                        textCol = columns[0];
                                    }

                                    var possibleDescColumns = ["description", "Description", "DESCRIPTION", "desc", "Desc", "notes", "Notes"];
                                    var descCol = null;
                                    for (var j = 0; j < possibleDescColumns.length; j++) {
                                        if (columns.indexOf(possibleDescColumns[j]) !== -1 && possibleDescColumns[j] !== textCol) {
                                            descCol = possibleDescColumns[j];
                                            break;
                                        }
                                    }

                                    var texts = [];
                                    for (var k = 0; k < rawData.length; k++) {
                                        var row = rawData[k];
                                        var src = String(row[textCol] || "").trim();
                                        var desc = descCol && row[descCol] ? String(row[descCol]).trim() : "";
                                        if (["nan", "none", ""].indexOf(desc.toLowerCase()) !== -1) {
                                            desc = "";
                                        }
                                        if (src && ["nan", "none", ""].indexOf(src.toLowerCase()) === -1) {
                                            texts.push({
                                                index: k,
                                                text: src,
                                                description: desc
                                            });
                                        }
                                    }

                                    if (texts.length === 0) {
                                        oDialog.setBusy(false);
                                        MessageBox.error("No valid text rows found in Excel file.");
                                        return;
                                    }

                                    oModel.setProperty("/statusText", "Calling native CAP OData action: massTranslate (" + texts.length + " texts x " + aTargets.length + " languages)...");

                                    fetch(getBaseUrl("api/massTranslate"), {
                                        method: "POST",
                                        headers: {
                                            "Content-Type": "application/json"
                                        },
                                        body: JSON.stringify({
                                            textsJson: JSON.stringify(texts),
                                            targetLanguages: JSON.stringify(aTargets)
                                        })
                                    })
                                    .then(function (res) { return res.json(); })
                                    .then(function (resData) {
                                        oDialog.setBusy(false);
                                        var result = resData && resData.value ? resData.value : resData;
                                        if (result && result.success) {
                                            oDialog.close();
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
                                            MessageBox.error((result && result.error) || "Batch translation failed.");
                                        }
                                    })
                                    .catch(function (fetchErr) {
                                        oDialog.setBusy(false);
                                        MessageBox.error("Request error: " + fetchErr.message);
                                    });

                                } catch (parseErr) {
                                    oDialog.setBusy(false);
                                    MessageBox.error("Failed to parse Excel file: " + parseErr.message);
                                }
                            };

                            reader.onerror = function (readErr) {
                                oDialog.setBusy(false);
                                MessageBox.error("File reading error: " + readErr.message);
                            };

                            reader.readAsArrayBuffer(oFile);
                        }).catch(function (err) {
                            oDialog.setBusy(false);
                            MessageBox.error("Excel parser library is not loaded: " + err.message);
                        });
                    }
                }),
                endButton: new Button({
                    text: "Close",
                    press: function () {
                        oDialog.close();
                    }
                })
            });

            oDialog.addStyleClass("sapUiContentPadding sapUiResponsivePadding");
            oDialog.setModel(oModel, "dialog");
            oDialog.open();
        }
    });
});

