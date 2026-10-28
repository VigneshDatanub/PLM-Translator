// =============================================================
// PLM Translator - Single Translation Controller
// =============================================================
// Handles user interactions for single text translation:
// 1. Invoking CAP OData Action: /api/translate
// 2. Persisting test evaluation to CAP OData Entity: /api/TestResults
// 3. Clipboard copy, character counting, and validation
// =============================================================

sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("plm.translator.app.controller.Translator", {

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

            // Call CAP OData action /api/translate
            fetch("/api/translate", {
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

            fetch("/api/TestResults", {
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
