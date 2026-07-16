(function(window) {
    // Environment variables (substituted by entrypoint.sh / envsubst at container start)
    window["LIPID_MANAGEMENT_FHIR_BASE_URL"] = "${LIPID_MANAGEMENT_FHIR_BASE_URL}";
    window["LIPID_MANAGEMENT_SMART_CLIENT_ID"] = "${LIPID_MANAGEMENT_SMART_CLIENT_ID}";
    window["LIPID_MANAGEMENT_SMART_REDIRECT_URI"] = "${LIPID_MANAGEMENT_SMART_REDIRECT_URI}";
})(this);
