/**
 * Calculation-related JavaScript functions
 */

// Polling function for background tasks
function pollTaskStatus(taskId, statusUrl, onProgress, onComplete, onError) {
    const interval = setInterval(function() {
        $.ajax({
            url: statusUrl.replace('<task_id>', taskId),
            method: 'GET',
            success: function(response) {
                if (response.state === 'PROGRESS') {
                    if (onProgress) {
                        onProgress(response.current, response.total, response.status);
                    }
                } else if (response.state === 'SUCCESS') {
                    clearInterval(interval);
                    if (onComplete) {
                        onComplete(response.result);
                    }
                } else if (response.state === 'FAILURE') {
                    clearInterval(interval);
                    if (onError) {
                        onError(response.error);
                    }
                }
            },
            error: function(xhr) {
                clearInterval(interval);
                if (onError) {
                    onError('Failed to get task status');
                }
            }
        });
    }, 1000);  // Poll every second

    return interval;
}

// Update progress bar
function updateProgressBar(progressBarId, current, total) {
    const percentage = Math.round((current / total) * 100);
    $(`#${progressBarId}`).css('width', percentage + '%')
                          .attr('aria-valuenow', percentage)
                          .text(percentage + '%');
}

// Export plot as PNG
function downloadPlot(imgSrc, filename) {
    const link = document.createElement('a');
    link.href = imgSrc;
    link.download = filename || 'plot.png';
    link.click();
}

// Export data as CSV
function exportToCSV(data, filename) {
    // TODO: Implement CSV export
    console.log('CSV export not yet implemented');
}
