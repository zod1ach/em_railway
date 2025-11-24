/**
 * Main application JavaScript
 */

// Global configuration save/load functions
function saveConfiguration() {
    // Get active tab
    const activeTab = $('.tab-pane.active').attr('id');

    // Collect all form data from active tab
    const formData = {};
    $(`#${activeTab} form`).each(function() {
        $(this).serializeArray().forEach(item => {
            formData[item.name] = item.value;
        });
    });

    // Create JSON
    const config = {
        tab: activeTab,
        timestamp: new Date().toISOString(),
        parameters: formData
    };

    // Download as JSON file
    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `emcalc_config_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

function loadConfiguration() {
    $('#config-file-input').click();
}

// Handle config file selection
$(document).ready(function() {
    $('#config-file-input').on('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const config = JSON.parse(event.target.result);

                // Switch to the correct tab
                if (config.tab) {
                    $(`#${config.tab}-tab`).tab('show');
                }

                // Populate form fields
                if (config.parameters) {
                    Object.keys(config.parameters).forEach(key => {
                        $(`#${key}`).val(config.parameters[key]);
                    });
                }

                alert('Configuration loaded successfully!');
            } catch (error) {
                alert('Error loading configuration: ' + error.message);
            }
        };
        reader.readAsText(file);

        // Reset input so same file can be loaded again
        $(this).val('');
    });

    // Remember active tab in session storage
    $('button[data-bs-toggle="tab"]').on('shown.bs.tab', function(e) {
        sessionStorage.setItem('activeTab', $(e.target).data('bs-target'));
    });

    // Restore active tab on page load
    const activeTab = sessionStorage.getItem('activeTab');
    if (activeTab) {
        $(` button[data-bs-target="${activeTab}"]`).tab('show');
    }
});
