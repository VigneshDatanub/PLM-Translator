sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/VBox",
    "sap/m/HBox",
    "sap/m/Label",
    "sap/m/MultiComboBox",
    "sap/m/Input",
    "sap/m/Text",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Item",
    "sap/ui/unified/FileUploader",
    "sap/ui/model/json/JSONModel"
], function (
    ControllerExtension,
    Dialog, Button, VBox, HBox, Label, MultiComboBox, Input, Text,
    MessageToast, MessageBox, Item, FileUploader, JSONModel
) {
    "use strict";

    function getBaseUrl(sPath) {
        var sClean = sPath.startsWith("/") ? sPath.slice(1) : sPath;
        return "/" + sClean;
    }

    return ControllerExtension.extend("plm.translator.app.ext.customActions", {
        /**
         * @ui5ignore
         * @public
         * Mass Translation Excel Upload Action Dialog
         */
        onMassUpload: function (oEvent) {
            var oView = (this.base && this.base.getView) ? this.base.getView() : null;
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
                title: "Mass Translation",
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
                                            if (window.XLSX) {
                                                var wb = window.XLSX.utils.book_new();
                                                var wsData = [
                                                    ["Phrase Text", "Description"],
                                                    ["Welcome to our application", "Header greeting"],
                                                    ["Save Changes", "Button label"],
                                                    ["Error loading data", "Error alert"]
                                                ];
                                                var ws = window.XLSX.utils.aoa_to_sheet(wsData);
                                                ws["!cols"] = [{ wch: 35 }, { wch: 25 }];
                                                window.XLSX.utils.book_append_sheet(wb, ws, "Translations");
                                                window.XLSX.writeFile(wb, "mass_translation_template.xlsx");
                                                MessageToast.show("Template downloaded successfully.");
                                            } else {
                                                MessageBox.error("Excel export library is not loaded.");
                                            }
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

                        if (!window.XLSX) {
                            MessageBox.error("Excel parser library is not loaded.");
                            return;
                        }

                        oDialog.setBusy(true);
                        oModel.setProperty("/statusText", "Reading and parsing Excel file in browser...");

                        var reader = new FileReader();
                        reader.onload = function (e) {
                            try {
                                var data = new Uint8Array(e.target.result);
                                var workbook = window.XLSX.read(data, { type: "array" });
                                var sheetName = workbook.SheetNames[0];
                                if (!sheetName) {
                                    oDialog.setBusy(false);
                                    MessageBox.error("Excel file has no sheets.");
                                    return;
                                }

                                var worksheet = workbook.Sheets[sheetName];
                                var rawData = window.XLSX.utils.sheet_to_json(worksheet, { defval: "" });
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
                                        targetLanguages: JSON.stringify(aTargets),
                                        testedBy: sTester.trim()
                                    })
                                })
                                .then(function (res) { return res.json(); })
                                .then(function (resData) {
                                    oDialog.setBusy(false);
                                    var result = resData && resData.value ? resData.value : resData;
                                    if (result && result.success) {
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

