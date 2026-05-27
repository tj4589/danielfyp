document.addEventListener('DOMContentLoaded', () => {
    // Helper to upload CSV files (used for both manual uploads and typed reviews)
    function uploadCsv(file) {
        const formData = new FormData();
        formData.append('file', file);
        // Admin token must match server-side ADMIN_TOKEN
        fetch('/api/csv', {
            method: 'POST',
            headers: { 'x-admin-token': 'admin-secret' },
            body: formData
        })
        .then(res => {
            if (!res.ok) {
                console.error('CSV upload failed', res.statusText);
            } else {
                // Refresh admin dashboard data
                fetchFeedback();
            }
        })
        .catch(err => console.error('Error uploading CSV:', err));
    }
    // Export to global scope if needed elsewhere
    window.uploadCsv = uploadCsv;

    // DOM Elements
    const runAnalysisBtn = document.getElementById('run-analysis-btn');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    const dashboardContent = document.getElementById('dashboard-content');
    const uploadZone = document.getElementById('upload-zone');
    const reviewInput = document.getElementById('review-input');
    const closeInsightBtn = document.querySelector('.ai-insight-box .icon-btn');
    const insightBox = document.querySelector('.ai-insight-box');
    const aiInsightText = document.querySelector('.ai-content-text');
    
    // Feature Elements
    const themeToggleBtn = document.getElementById('theme-toggle');
    const searchInput = document.getElementById('search-reviews');
    const filterSelect = document.getElementById('filter-sentiment');
    const exportBtn = document.getElementById('export-csv-btn');
    const tableBody = document.getElementById('feedback-table-body');
    let tableRows = []; // Will hold DOM elements for filtering
    let previousFeedbackCount = 0;
    
    // Dynamic Metric Elements
    const metricTotal = document.getElementById('metric-total');
    const metricRating = document.getElementById('metric-rating');
    const metricRatingTrend = document.getElementById('metric-rating-trend');
    const metricHealth = document.getElementById('metric-health');
    const metricCritical = document.getElementById('metric-critical');
    
    // Notification Elements
    const notificationBadge = document.getElementById('notification-badge');
    const notificationList = document.getElementById('notification-list');
    const noNotifications = document.getElementById('no-notifications');

    // Critical Alerts Modal
    const criticalAlertsContainer = document.getElementById('critical-alerts-container');

    // 1. Dark Mode Toggle
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const htmlElement = document.documentElement;
            const isDark = htmlElement.getAttribute('data-bs-theme') === 'dark';
            htmlElement.setAttribute('data-bs-theme', isDark ? 'light' : 'dark');
            
            const icon = themeToggleBtn.querySelector('i');
            if (!isDark) {
                icon.classList.replace('ph-moon', 'ph-sun');
            } else {
                icon.classList.replace('ph-sun', 'ph-moon');
            }
            
            // Update chart grid colors
            if (trendChartInstance) {
                trendChartInstance.options.scales.y.grid.color = !isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
                trendChartInstance.update();
            }
        });
    }

    // 2. Search & Filter Table
    function filterTable() {
        if (!searchInput || !filterSelect) return;
        
        const searchTerm = searchInput.value.toLowerCase();
        const sentimentFilter = filterSelect.value.toLowerCase();

        tableRows.forEach(row => {
            const textElement = row.querySelector('.review-text');
            const sentimentElement = row.querySelector('.sentiment-badge');
            
            if(!textElement || !sentimentElement) return;

            const text = textElement.textContent.toLowerCase();
            const sentiment = sentimentElement.textContent.toLowerCase();
            
            const matchesSearch = text.includes(searchTerm);
            const matchesSentiment = sentimentFilter === 'all' || sentiment === sentimentFilter;

            if (matchesSearch && matchesSentiment) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    if (searchInput) searchInput.addEventListener('input', filterTable);
    if (filterSelect) filterSelect.addEventListener('change', filterTable);

    // 3. Export CSV
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            let csvContent = "data:text/csv;charset=utf-8,";
            // Header
            csvContent += "Review Snippet,Rating,Emotion,Sentiment\n";
            
            tableRows.forEach(row => {
                if (row.style.display !== 'none') {
                    // Escape quotes in review text
                    const textEl = row.querySelector('.review-text');
                    if(textEl) {
                        const review = `"${textEl.textContent.replace(/"/g, '""')}"`;
                        const rating = row.querySelectorAll('.ph-fill.ph-star').length;
                        const emotion = row.querySelector('.emotion-tag').textContent.trim();
                        const sentiment = row.querySelector('.sentiment-badge').textContent.trim();
                        csvContent += `${review},${rating},${emotion},${sentiment}\n`;
                    }
                }
            });
            
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "cx_feedback_log.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    // AI Insight Data Typewriter
    const originalAiText = "Our NLP engine detected a 15% spike in frustration regarding shipping times over the last 48 hours. The sentiment confidence is very high. It is recommended to update the estimated delivery times on the checkout page to manage expectations.";
    
    function typeWriter(text, element, speed = 20) {
        element.textContent = "";
        let i = 0;
        function type() {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                setTimeout(type, speed);
            }
        }
        type();
    }

    // --- Backend API Integration ---
    async function fetchFeedback() {
        try {
            const response = await fetch('/api/feedback');
            if (response.ok) {
                const data = await response.json();
                
                // Update Notifications
                if (data.length > previousFeedbackCount && previousFeedbackCount !== 0) {
                    notificationBadge.classList.remove('d-none');
                }
                previousFeedbackCount = data.length;

                updateMetrics(data);
                renderTable(data);
                populateNotifications(data);
                populateCriticalAlerts(data);
            }
        } catch (error) {
            console.error('Error fetching feedback:', error);
        }
    }

    function updateMetrics(data) {
        if (data.length === 0) {
            if(metricTotal) metricTotal.textContent = "0";
            if(metricRating) metricRating.textContent = "0.0";
            if(metricHealth) metricHealth.textContent = "0";
            if(metricCritical) metricCritical.textContent = "0";
            if(metricRatingTrend) metricRatingTrend.classList.add('d-none');
            return;
        }

        const total = data.length;
        const avgRating = (data.reduce((sum, item) => sum + item.rating, 0) / total).toFixed(1);
        const criticalCount = data.filter(item => item.sentiment === 'Critical').length;
        const healthScore = Math.round(((total - criticalCount) / total) * 100);

        if(metricTotal) metricTotal.textContent = total;
        if(metricRating) metricRating.textContent = avgRating;
        if(metricHealth) metricHealth.textContent = healthScore;
        if(metricCritical) metricCritical.textContent = criticalCount;
        
        if(metricRatingTrend && avgRating > 0) metricRatingTrend.classList.remove('d-none');
    }

    function populateNotifications(data) {
        if (!notificationList) return;
        
        // Get the latest 5 submissions
        const recent = data.slice(0, 5);
        if (recent.length === 0) return;

        // Clear existing notifications (keep header)
        const header = notificationList.querySelector('.dropdown-header').outerHTML;
        notificationList.innerHTML = `<li>${header}</li>`;

        recent.forEach(item => {
            const isCritical = item.sentiment === 'Critical';
            const icon = isCritical ? '<i class="ph-fill ph-warning-octagon text-danger"></i>' : '<i class="ph-fill ph-info text-primary"></i>';
            const li = document.createElement('li');
            li.innerHTML = `
                <a class="dropdown-item py-2 d-flex align-items-start gap-2 border-bottom" href="#">
                    <div class="mt-1">${icon}</div>
                    <div>
                        <div class="small fw-medium text-truncate" style="max-width: 200px;">${item.snippet}</div>
                        <div class="small text-muted" style="font-size: 11px;">Sentiment: ${item.sentiment}</div>
                    </div>
                </a>
            `;
            notificationList.appendChild(li);
        });

        // Hide badge when dropdown is opened
        const notificationDropdown = document.getElementById('notificationDropdown');
        if (notificationDropdown) {
            notificationDropdown.addEventListener('show.bs.dropdown', () => {
                notificationBadge.classList.add('d-none');
            });
        }
    }

    function populateCriticalAlerts(data) {
        if (!criticalAlertsContainer) return;

        const criticals = data.filter(item => item.sentiment === 'Critical');
        
        if (criticals.length === 0) {
            criticalAlertsContainer.innerHTML = '<div class="text-center text-muted py-5">No critical alerts to review! You\\'re doing great.</div>';
            return;
        }

        criticalAlertsContainer.innerHTML = '';
        criticals.forEach(item => {
            const div = document.createElement('div');
            div.className = 'p-3 border rounded bg-body position-relative overflow-hidden shadow-sm';
            div.innerHTML = `
                <div class="position-absolute top-0 start-0 h-100 bg-danger" style="width: 4px;"></div>
                <div class="d-flex justify-content-between align-items-start mb-2 ps-2">
                    <div class="fw-medium text-body d-flex align-items-center gap-2">
                        <i class="ph ph-user"></i> Customer Feedback
                    </div>
                    <span class="badge bg-danger-subtle text-danger">Confidence: ${item.confidence}%</span>
                </div>
                <div class="small text-muted mb-2 ps-2">"${item.snippet}"</div>
                <div class="d-flex gap-1 ps-2">
                    <span class="badge bg-body-tertiary border text-muted fw-normal" style="font-size: 10px;">Emotion: ${item.emotion}</span>
                    <span class="badge bg-body-tertiary border text-muted fw-normal" style="font-size: 10px;">Rating: ${item.rating}/5</span>
                </div>
            `;
            criticalAlertsContainer.appendChild(div);
        });
    }

    function getEmotionIcon(emotion) {
        const map = {
            'Joy': 'ph-heart text-success',
            'Delighted': 'ph-star text-success',
            'Satisfied': 'ph-thumbs-up text-primary',
            'Neutral': 'ph-smiley-blank text-secondary',
            'Mixed': 'ph-smiley-meh text-muted',
            'Sadness': 'ph-smiley-sad text-warning',
            'Frustrated': 'ph-warning-octagon text-warning',
            'Anger': 'ph-smiley-sad text-danger'
        };
        return map[emotion] || 'ph-smiley-blank text-muted';
    }

    function getSentimentBadge(sentiment) {
        const map = {
            'Positive': 'bg-success-subtle text-success border-success-subtle',
            'Neutral': 'bg-secondary-subtle text-secondary border-secondary-subtle',
            'Critical': 'bg-danger-subtle text-danger border-danger-subtle'
        };
        return map[sentiment] || 'bg-secondary-subtle text-secondary';
    }

    function renderTable(data) {
        if (!tableBody) return;
        tableBody.innerHTML = '';
        tableRows = []; 

        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            
            let starsHtml = '';
            for(let s=0; s<5; s++) {
                if(s < item.rating) starsHtml += '<i class="ph-fill ph-star"></i>';
                else starsHtml += '<i class="ph ph-star"></i>';
            }

            tr.innerHTML = `
                <td class="ps-4 py-3">
                    <div class="review-text small fw-medium text-truncate" style="max-width: 300px;">${item.snippet}</div>
                </td>
                <td>
                    <div class="text-warning small letter-spacing-1 rating-stars">
                        ${starsHtml}
                    </div>
                </td>
                <td>
                    <div class="d-flex align-items-center gap-2 small emotion-tag text-body">
                        <i class="ph ${getEmotionIcon(item.emotion)} fs-5"></i> ${item.emotion}
                    </div>
                </td>
                <td><span class="small text-muted fw-medium">${item.confidence}%</span></td>
                <td class="text-end pe-4">
                    <span class="badge ${getSentimentBadge(item.sentiment)} border rounded-pill px-3 py-1 sentiment-badge">${item.sentiment}</span>
                </td>
            `;
            tableBody.appendChild(tr);
            tableRows.push(tr);
        });

        filterTable();
    }

    fetchFeedback();
    
    // Poll for new data every 5 seconds to simulate real-time notifications
    setInterval(fetchFeedback, 5000);

    if(runAnalysisBtn) {
        runAnalysisBtn.addEventListener('click', async () => {
            const text = reviewInput.value.trim();
            if (!text) {
                alert('Please enter a review to analyze.');
                return;
            }
            
            if (insightBox) {
                insightBox.style.display = 'flex';
                insightBox.style.opacity = '1';
                if (aiInsightText) aiInsightText.textContent = "";
            }

            loadingOverlay.classList.add('active');
            dashboardContent.style.opacity = '0.5';
            
            const originalText = runAnalysisBtn.innerHTML;
            runAnalysisBtn.innerHTML = '<span class="btn-text">Analyzing...</span> <div class="spinner-border spinner-border-sm" role="status"></div>';
            runAnalysisBtn.style.opacity = '0.8';
            runAnalysisBtn.disabled = true;

            const loaderSteps = ["Extracting text...", "Sending to Intelligence Engine...", "Detecting emotional tone...", "Saving results...", "Finalizing..."];
            let stepIndex = 0;
            if (loadingText) loadingText.textContent = loaderSteps[0];
            const loaderInterval = setInterval(() => {
                stepIndex++;
                if(stepIndex < loaderSteps.length && loadingText) loadingText.textContent = loaderSteps[stepIndex];
            }, 500);

            try {
                const response = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text })
                });

                if (response.ok) {
                    await fetchFeedback();
                    reviewInput.value = '';
                } else {
                    alert('Analysis failed.');
                }
            } catch (error) {
                alert('Could not connect to backend server.');
            } finally {
                clearInterval(loaderInterval);
                
                loadingOverlay.classList.remove('active');
                dashboardContent.style.opacity = '1';
                
                runAnalysisBtn.innerHTML = originalText;
                runAnalysisBtn.style.opacity = '1';
                runAnalysisBtn.disabled = false;
                
                if (aiInsightText) typeWriter(originalAiText, aiInsightText, 15);
                
                document.querySelector('.right-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    // Drag & Drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        if(uploadZone) uploadZone.addEventListener(eventName, e => {e.preventDefault(); e.stopPropagation();}, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        if(uploadZone) uploadZone.addEventListener(eventName, () => uploadZone.classList.add('drag-active'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        if(uploadZone) uploadZone.addEventListener(eventName, () => uploadZone.classList.remove('drag-active'), false);
    });

    if(uploadZone) {
        uploadZone.addEventListener('drop', e => {
            let files = e.dataTransfer.files;
            if (files.length > 0) handleFileUpload(files[0]);
        }, false);
        
        uploadZone.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.csv';
            input.onchange = e => {
                if (e.target.files.length > 0) handleFileUpload(e.target.files[0]);
            };
            input.click();
        });
    }

    function handleFileUpload(file) {
    uploadZone.querySelector('.upload-label').textContent = file.name;
    uploadZone.querySelector('.upload-sub').textContent = 'File ready for analysis';
    uploadZone.querySelector('.upload-icon').className = 'ph-fill ph-file-csv upload-icon text-primary';
    uploadZone.querySelector('.upload-icon').style.color = 'var(--bs-primary)';
        // Trigger CSV upload to backend
        uploadCsv(file);
        // Refresh admin metrics after a short delay to ensure DB write completes
        setTimeout(fetchFeedback, 800);
}

    if (closeInsightBtn && insightBox) {
        closeInsightBtn.addEventListener('click', () => {
            insightBox.style.opacity = '0';
            setTimeout(() => insightBox.style.display = 'none', 300);
        });
    }
    
    // Trend Tracking Chart
    const chartCanvas = document.getElementById('trendChart');
    let trendChartInstance = null;

    if (chartCanvas) {
        const ctx = chartCanvas.getContext('2d');
        
        // Match the new futuristic primary color
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');

        const chartConfig = {
            type: 'line',
            data: {
                labels: ['May 1', 'May 5', 'May 10', 'May 15', 'May 20', 'May 25', 'May 30'],
                datasets: [{
                    label: 'Sentiment Score',
                    data: [65, 68, 64, 72, 70, 75, 72],
                    borderColor: '#10B981',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#10B981',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(17, 24, 39, 0.9)',
                        titleFont: { family: 'Space Grotesk', size: 13 },
                        bodyFont: { family: 'Space Grotesk', size: 12 },
                        padding: 10,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return `Score: ${context.parsed.y}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        min: 50,
                        max: 100,
                        grid: {
                            color: 'rgba(0,0,0,0.05)',
                            drawBorder: false,
                        },
                        ticks: {
                            font: { family: 'Space Grotesk', size: 11 },
                            color: '#9CA3AF'
                        }
                    },
                    x: {
                        grid: { display: false, drawBorder: false },
                        ticks: {
                            font: { family: 'Space Grotesk', size: 11 },
                            color: '#9CA3AF'
                        }
                    }
                }
            }
        };
        trendChartInstance = new Chart(ctx, chartConfig);
    }

    // Issue Matrix Expansion Logic
    const expandMatrixBtn = document.getElementById('expand-matrix-btn');
    const issueMatrixCard = document.getElementById('issue-matrix-card');
    const matrixBackdrop = document.getElementById('matrix-backdrop');

    if (expandMatrixBtn && issueMatrixCard && matrixBackdrop) {
        expandMatrixBtn.addEventListener('click', () => {
            const isExpanded = issueMatrixCard.classList.contains('issue-matrix-expanded');
            
            if (!isExpanded) {
                // Expand
                issueMatrixCard.classList.add('issue-matrix-expanded');
                matrixBackdrop.classList.add('show');
                expandMatrixBtn.innerHTML = '<i class="ph ph-corners-in"></i>';
                document.body.style.overflow = 'hidden'; // Prevent background scrolling
            } else {
                // Collapse
                issueMatrixCard.classList.remove('issue-matrix-expanded');
                matrixBackdrop.classList.remove('show');
                expandMatrixBtn.innerHTML = '<i class="ph ph-arrows-out-simple"></i>';
                document.body.style.overflow = '';
            }
        });

        // Click outside to collapse
        matrixBackdrop.addEventListener('click', () => {
            issueMatrixCard.classList.remove('issue-matrix-expanded');
            matrixBackdrop.classList.remove('show');
            expandMatrixBtn.innerHTML = '<i class="ph ph-arrows-out-simple"></i>';
            document.body.style.overflow = '';
        });
    }

});
