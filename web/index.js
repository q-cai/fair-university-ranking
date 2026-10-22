(() => {
    // ——— Country flag emoji map ———
    const FLAGS = {
        'United States': '🇺🇸', 'United Kingdom': '🇬🇧', 'China': '🇨🇳',
        'Canada': '🇨🇦', 'Australia': '🇦🇺', 'Switzerland': '🇨🇭',
        'Singapore': '🇸🇬', 'Hong Kong SAR': '🇭🇰', 'Japan': '🇯🇵',
        'South Korea': '🇰🇷', 'France': '🇫🇷', 'Germany': '🇩🇪',
        'Netherlands': '🇳🇱', 'Sweden': '🇸🇪', 'Belgium': '🇧🇪',
        'Ireland': '🇮🇪', 'Denmark': '🇩🇰', 'New Zealand': '🇳🇿',
        'Taiwan': '🇹🇼', 'Malaysia': '🇲🇾', 'Argentina': '🇦🇷',
        'Brazil': '🇧🇷', 'Chile': '🇨🇱', 'Russia': '🇷🇺', 'Mexico': '🇲🇽'
    };

    let RAW_DATA = null;
    let currentFilter = 'all';
    let currentCountry = 'all';
    let searchQuery = '';
    let currentSort = { key: 'fair_rank', order: 'asc' };
    let currentScope = 20;
    let selectedUni = null;

    // D3 graph references for external control
    let graphZoom = null;
    let graphSvg = null;
    let graphSim = null;
    let graphNodesGroup = null;
    let graphLinksGroup = null;

    // ——— Load data.json ———
    fetch('data.json')
        .then(r => {
            if (!r.ok) throw new Error('Failed to load data.json');
            return r.json();
        })
        .then(data => {
            RAW_DATA = data;
            populateStats(data);
            populateCountryFilter(data.rankings);
            setupControls(data);
            applyFilterAndRender();
            renderNetwork(data.network, data.rankings, currentScope);
        })
        .catch(err => {
            console.error(err);
            document.getElementById('rankingsBody').innerHTML =
                `<tr><td colspan="7" style="color:var(--red);padding:2rem;text-align:center">
                    ❌ Could not load data.json.<br>
                    Run <code>python3 fair_ranking.py</code> first to regenerate data.<br>
                    Error: ${err.message}
                </td></tr>`;
        });

    // ——— Stats Overview ———
    function populateStats(data) {
        document.getElementById('statTotal').textContent = data.rankings.length;
        document.getElementById('statEdges').textContent = (data.total_connections || 11502).toLocaleString();
        if (data.rankings.length > 0) {
            const top = data.rankings[0];
            document.getElementById('statTop').textContent = top.university.replace(/\s*\(.*?\)\s*/g, '');
        }
    }

    // ——— Populate Country Filter ———
    function populateCountryFilter(rankings) {
        const countryCounts = {};
        rankings.forEach(r => {
            countryCounts[r.country] = (countryCounts[r.country] || 0) + 1;
        });

        const sortedCountries = Object.entries(countryCounts)
            .sort((a, b) => b[1] - a[1]);

        const select = document.getElementById('countrySelect');
        sortedCountries.forEach(([country, count]) => {
            const flag = FLAGS[country] || '🌍';
            const opt = document.createElement('option');
            opt.value = country;
            opt.textContent = `${flag} ${country} (${count})`;
            select.appendChild(opt);
        });
    }

    // ——— Filter and Sort Pipeline ———
    function getFilteredRankings() {
        if (!RAW_DATA) return [];
        let list = [...RAW_DATA.rankings];

        // 1. Text Search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(r => 
                r.university.toLowerCase().includes(q) ||
                r.country.toLowerCase().includes(q) ||
                String(r.fair_rank) === q ||
                String(r.qs_rank) === q
            );
        }

        // 2. Segment filter
        if (currentFilter === 'us') {
            list = list.filter(r => r.country === 'United States');
        } else if (currentFilter === 'intl') {
            list = list.filter(r => r.country !== 'United States');
        } else if (currentFilter === 'gainers') {
            list = list.filter(r => (r.qs_rank - r.fair_rank) > 0);
        } else if (currentFilter === 'drops') {
            list = list.filter(r => (r.qs_rank - r.fair_rank) < 0);
        }

        // 3. Country Dropdown
        if (currentCountry !== 'all') {
            list = list.filter(r => r.country === currentCountry);
        }

        // 4. Sorting
        list.sort((a, b) => {
            let valA = a[currentSort.key];
            let valB = b[currentSort.key];

            if (currentSort.key === 'delta') {
                valA = a.qs_rank - a.fair_rank;
                valB = b.qs_rank - b.fair_rank;
            }

            if (typeof valA === 'string') {
                return currentSort.order === 'asc' 
                    ? valA.localeCompare(valB) 
                    : valB.localeCompare(valA);
            } else {
                return currentSort.order === 'asc' 
                    ? valA - valB 
                    : valB - valA;
            }
        });

        return list;
    }

    function applyFilterAndRender() {
        const filtered = getFilteredRankings();
        renderTable(filtered);
        updateTableCount(filtered.length, RAW_DATA ? RAW_DATA.rankings.length : 0);
    }

    function updateTableCount(shown, total) {
        const countEl = document.getElementById('tableCount');
        if (shown === total) {
            countEl.textContent = `${total} Universities`;
        } else {
            countEl.textContent = `Showing ${shown} of ${total}`;
        }
    }

    // ——— Render Table ———
    function renderTable(rankings) {
        const tbody = document.getElementById('rankingsBody');
        tbody.innerHTML = '';

        if (rankings.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="padding:2.5rem;text-align:center;color:var(--text-muted)">
                🔍 No universities matched your search criteria.
            </td></tr>`;
            return;
        }

        const maxScore = Math.max(...RAW_DATA.rankings.map(r => r.score));

        rankings.forEach(r => {
            const delta = r.qs_rank - r.fair_rank;
            let deltaClass = 'same', deltaText = '—';
            if (delta > 0) { deltaClass = 'up'; deltaText = `▲+${delta}`; }
            else if (delta < 0) { deltaClass = 'down'; deltaText = `▼${delta}`; }

            const barPct = (r.score / maxScore * 100).toFixed(1);
            const flag = FLAGS[r.country] || '🌍';

            const tr = document.createElement('tr');
            tr.dataset.uni = r.mapped_name;
            if (selectedUni && selectedUni.mapped_name === r.mapped_name) {
                tr.classList.add('selected-row');
            }

            tr.innerHTML = `
                <td>#${r.fair_rank}</td>
                <td><span class="delta ${deltaClass}">${deltaText}</span></td>
                <td class="uni-name-cell" title="${r.university}">${r.university}</td>
                <td><span class="country-tag">${flag} ${r.country}</span></td>
                <td style="color:var(--text-secondary)">#${r.qs_rank}</td>
                <td style="font-weight:600">${r.total_placed.toLocaleString()}</td>
                <td>
                    <div class="score-cell">
                        <span class="score-num">${r.score.toFixed(2)}</span>
                        <div class="score-bar-bg"><div class="score-bar-fill" style="width:${barPct}%"></div></div>
                    </div>
                </td>
            `;

            // Row click: Open profile modal
            tr.addEventListener('click', () => {
                openUniversityModal(r);
            });

            // Row hover: highlight in graph if rendered
            tr.addEventListener('mouseenter', () => {
                highlightGraphNode(r.mapped_name);
            });
            tr.addEventListener('mouseleave', () => {
                resetGraphHighlight();
            });

            tbody.appendChild(tr);
        });
    }

    // ——— Controls Setup ———
    function setupControls(data) {
        // 1. Search input
        const searchInput = document.getElementById('searchInput');
        const clearBtn = document.getElementById('clearSearch');

        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            clearBtn.style.display = searchQuery ? 'block' : 'none';
            applyFilterAndRender();
        });

        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchQuery = '';
            clearBtn.style.display = 'none';
            searchInput.focus();
            applyFilterAndRender();
        });

        // 2. Segment filter buttons
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentFilter = this.dataset.filter;
                applyFilterAndRender();
            });
        });

        // 3. Country select
        const countrySelect = document.getElementById('countrySelect');
        countrySelect.addEventListener('change', (e) => {
            currentCountry = e.target.value;
            applyFilterAndRender();
        });

        // 4. Table Header Sorting
        document.querySelectorAll('th.sortable').forEach(th => {
            th.addEventListener('click', function () {
                const sortKey = this.dataset.sort;
                if (currentSort.key === sortKey) {
                    currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSort.key = sortKey;
                    // Default to desc for score, total_placed, delta; asc for rank and names
                    currentSort.order = ['score', 'total_placed', 'delta'].includes(sortKey) ? 'desc' : 'asc';
                }

                // Update sort icons in UI
                document.querySelectorAll('th.sortable .sort-icon').forEach(icon => {
                    icon.textContent = '';
                });
                const activeIcon = this.querySelector('.sort-icon');
                if (activeIcon) {
                    activeIcon.textContent = currentSort.order === 'asc' ? '▲' : '▼';
                }

                applyFilterAndRender();
            });
        });

        // 5. Network Scope Selector
        const nodeScope = document.getElementById('nodeScope');
        nodeScope.addEventListener('change', (e) => {
            currentScope = parseInt(e.target.value, 10);
            renderNetwork(data.network, data.rankings, currentScope);
        });

        // 6. Network Zoom Buttons
        document.getElementById('btnZoomIn').addEventListener('click', () => {
            if (graphSvg && graphZoom) graphSvg.transition().duration(300).call(graphZoom.scaleBy, 1.3);
        });
        document.getElementById('btnZoomOut').addEventListener('click', () => {
            if (graphSvg && graphZoom) graphSvg.transition().duration(300).call(graphZoom.scaleBy, 0.7);
        });
        document.getElementById('btnZoomReset').addEventListener('click', () => {
            if (graphSvg && graphZoom) graphSvg.transition().duration(400).call(graphZoom.transform, d3.zoomIdentity);
        });

        // 7. CSV Export Button
        document.getElementById('btnExportCsv').addEventListener('click', () => {
            exportRankingsCsv(getFilteredRankings());
        });

        // 8. Modal Close Events
        const modal = document.getElementById('uniModal');
        document.getElementById('modalClose').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                closeModal();
            }
        });

        // 9. Modal Action: Focus in Graph
        document.getElementById('modalFocusGraph').addEventListener('click', () => {
            if (selectedUni) {
                closeModal();
                focusNodeInGraph(selectedUni.mapped_name);
            }
        });
    }

    // ——— CSV Export ———
    function exportRankingsCsv(rankings) {
        if (!rankings || rankings.length === 0) return;

        const headers = ['FairRank', 'QS_Rank', 'Delta', 'University', 'Country', 'FairRank_Score', 'External_PhDs_Placed', 'Observed_Faculty_Hired'];
        const rows = rankings.map(r => [
            r.fair_rank,
            r.qs_rank,
            r.qs_rank - r.fair_rank,
            `"${r.university.replace(/"/g, '""')}"`,
            `"${r.country.replace(/"/g, '""')}"`,
            r.score,
            r.total_placed,
            r.total_hired || 0
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `fair_university_rankings_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // ——— University Profile Modal ———
    function openUniversityModal(uni) {
        selectedUni = uni;
        const modal = document.getElementById('uniModal');

        // Header info
        document.getElementById('modalFlag').textContent = FLAGS[uni.country] || '🌍';
        document.getElementById('modalUniName').textContent = uni.university;
        document.getElementById('modalCountry').textContent = uni.country;

        document.getElementById('modalFairRank').textContent = `#${uni.fair_rank}`;
        document.getElementById('modalQsRank').textContent = `#${uni.qs_rank}`;

        const delta = uni.qs_rank - uni.fair_rank;
        const deltaEl = document.getElementById('modalDelta');
        deltaEl.className = 'badge-delta';
        if (delta > 0) {
            deltaEl.classList.add('up');
            deltaEl.textContent = `▲+${delta}`;
        } else if (delta < 0) {
            deltaEl.classList.add('down');
            deltaEl.textContent = `▼${delta}`;
        } else {
            deltaEl.classList.add('same');
            deltaEl.textContent = '—';
        }

        // Stats
        document.getElementById('modalScore').textContent = uni.score.toFixed(2);
        document.getElementById('modalPlaced').textContent = uni.total_placed.toLocaleString();
        document.getElementById('modalHired').textContent = (uni.total_hired || 0).toLocaleString();

        // Top Placement Destinations list
        const destContainer = document.getElementById('modalDestList');
        destContainer.innerHTML = '';
        if (uni.top_destinations && uni.top_destinations.length > 0) {
            const maxDest = Math.max(...uni.top_destinations.map(d => d.count));
            uni.top_destinations.forEach(d => {
                const pct = (d.count / maxDest * 100).toFixed(0);
                const item = document.createElement('div');
                item.className = 'flow-item';
                item.innerHTML = `
                    <div class="flow-item-header">
                        <span class="flow-item-name" title="${d.name}">${d.name}</span>
                        <span class="flow-item-count">${d.count} PhDs</span>
                    </div>
                    <div class="flow-bar-bg"><div class="flow-bar-fill" style="width:${pct}%"></div></div>
                `;
                destContainer.appendChild(item);
            });
        } else {
            destContainer.innerHTML = `<div class="empty-flow">No outgoing top placement data recorded</div>`;
        }

        // Top Faculty Feeders list
        const feederContainer = document.getElementById('modalFeederList');
        feederContainer.innerHTML = '';
        if (uni.top_feeders && uni.top_feeders.length > 0) {
            const maxFeeder = Math.max(...uni.top_feeders.map(f => f.count));
            uni.top_feeders.forEach(f => {
                const pct = (f.count / maxFeeder * 100).toFixed(0);
                const item = document.createElement('div');
                item.className = 'flow-item';
                item.innerHTML = `
                    <div class="flow-item-header">
                        <span class="flow-item-name" title="${f.name}">${f.name}</span>
                        <span class="flow-item-count">${f.count} faculty</span>
                    </div>
                    <div class="flow-bar-bg"><div class="flow-bar-fill" style="width:${pct}%"></div></div>
                `;
                feederContainer.appendChild(item);
            });
        } else {
            feederContainer.innerHTML = `<div class="empty-flow">No incoming faculty feeder data recorded</div>`;
        }

        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
    }

    function closeModal() {
        const modal = document.getElementById('uniModal');
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
    }

    // ——— D3 Network Graph ———
    function renderNetwork(fullNetwork, rankings, maxNodes = 20) {
        const container = document.getElementById('networkGraph');
        container.innerHTML = '';

        const width = container.clientWidth || 700;
        const height = container.clientHeight || 500;

        // Build score lookup
        const scoreMap = {};
        rankings.forEach(r => { scoreMap[r.mapped_name] = r.score; });
        const maxScore = Math.max(...Object.values(scoreMap));

        // Filter nodes and links to top N
        const allowedNodes = fullNetwork.nodes.slice(0, maxNodes);
        const allowedSet = new Set(allowedNodes.map(n => n.id));

        const nodes = allowedNodes.map(n => ({ ...n }));
        const links = fullNetwork.links
            .filter(l => allowedSet.has(l.source.id || l.source) && allowedSet.has(l.target.id || l.target))
            .map(l => ({ ...l }));

        const maxWeight = Math.max(...links.map(l => l.weight), 1);

        // SVG & Zoom container
        const svg = d3.select('#networkGraph')
            .append('svg')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');

        graphSvg = svg;

        // Arrow marker definition
        const defs = svg.append('defs');
        defs.append('marker')
            .attr('id', 'arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 22)
            .attr('refY', 0)
            .attr('markerWidth', 5)
            .attr('markerHeight', 5)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', 'rgba(99, 102, 241, 0.4)');

        defs.append('marker')
            .attr('id', 'arrow-active')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 22)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', '#06b6d4');

        const g = svg.append('g').attr('class', 'main-graph-group');

        // Setup Zoom
        graphZoom = d3.zoom()
            .scaleExtent([0.4, 4])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(graphZoom);

        // Simulation
        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(120))
            .force('charge', d3.forceManyBody().strength(-360))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(d => nodeRadius(d) + 8));

        graphSim = simulation;

        function nodeRadius(d) {
            const s = scoreMap[d.id] || 0.1;
            return 8 + (s / maxScore) * 18;
        }

        // Links
        const link = g.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(links)
            .join('line')
            .attr('stroke', 'rgba(99, 102, 241, 0.28)')
            .attr('stroke-width', d => Math.max(0.6, (d.weight / maxWeight) * 4))
            .attr('stroke-linecap', 'round')
            .attr('marker-end', 'url(#arrow)');

        graphLinksGroup = link;

        // Nodes
        const node = g.append('g')
            .attr('class', 'nodes')
            .selectAll('circle')
            .data(nodes)
            .join('circle')
            .attr('r', d => nodeRadius(d))
            .attr('fill', d => {
                const s = scoreMap[d.id] || 0;
                const t = s / maxScore;
                return d3.interpolateViridis(0.35 + t * 0.6);
            })
            .attr('stroke', 'rgba(255, 255, 255, 0.85)')
            .attr('stroke-width', 1.5)
            .style('cursor', 'pointer')
            .call(drag(simulation));

        graphNodesGroup = node;

        // Labels
        const label = g.append('g')
            .attr('class', 'labels')
            .selectAll('text')
            .data(nodes)
            .join('text')
            .attr('text-anchor', 'middle')
            .attr('dy', d => nodeRadius(d) + 14)
            .attr('fill', '#cbd5e1')
            .attr('font-size', '10px')
            .attr('font-weight', '500')
            .attr('font-family', 'Inter, sans-serif')
            .attr('pointer-events', 'none')
            .text(d => d.id.replace(/\s*\(.*?\)\s*/g, ''));

        // Tooltip
        const tooltip = document.getElementById('tooltip');

        node.on('mouseenter', (event, d) => {
            const r = rankings.find(x => x.mapped_name === d.id);
            const flag = r ? (FLAGS[r.country] || '🌍') : '🌍';

            // Find placement and hiring in top network
            const placedInNet = links.filter(l => (l.target.id || l.target) === d.id).reduce((sum, l) => sum + l.weight, 0);
            const hiredFromNet = links.filter(l => (l.source.id || l.source) === d.id).reduce((sum, l) => sum + l.weight, 0);

            tooltip.innerHTML = `
                <div style="font-size:0.92rem;font-weight:700;color:#fff;margin-bottom:3px">${flag} ${r ? r.university : d.id}</div>
                <div style="color:var(--text-secondary);font-size:0.78rem">
                    FairRank: <strong style="color:var(--accent-3)">#${r ? r.fair_rank : '—'}</strong> · QS: <strong>#${r ? r.qs_rank : '—'}</strong><br>
                    Score: <strong>${r ? r.score.toFixed(2) : '—'}</strong> · Placed: <strong>${r ? r.total_placed.toLocaleString() : '—'}</strong><br>
                    Network Flow: <span style="color:#06b6d4">${placedInNet} placed</span> · <span style="color:#a78bfa">${hiredFromNet} hired</span>
                </div>
                <div style="margin-top:6px;font-size:0.72rem;color:var(--text-muted)">👆 Click to view full placement breakdown</div>
            `;
            tooltip.classList.add('visible');

            highlightConnected(d.id);
        });

        node.on('mousemove', (event) => {
            tooltip.style.left = (event.clientX + 16) + 'px';
            tooltip.style.top = (event.clientY - 12) + 'px';
        });

        node.on('mouseleave', () => {
            tooltip.classList.remove('visible');
            resetGraphHighlight();
        });

        // Click node to open modal
        node.on('click', (event, d) => {
            const r = rankings.find(x => x.mapped_name === d.id);
            if (r) openUniversityModal(r);
        });

        // Simulation Tick
        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);
            label
                .attr('x', d => d.x)
                .attr('y', d => d.y);
        });

        function highlightConnected(nodeId) {
            const connectedSources = new Set();
            const connectedTargets = new Set();

            links.forEach(l => {
                const s = l.source.id || l.source;
                const t = l.target.id || l.target;
                if (s === nodeId) connectedTargets.add(t);
                if (t === nodeId) connectedSources.add(s);
            });

            node.attr('opacity', d => 
                (d.id === nodeId || connectedSources.has(d.id) || connectedTargets.has(d.id)) ? 1 : 0.15
            );

            link
                .attr('opacity', l => {
                    const s = l.source.id || l.source;
                    const t = l.target.id || l.target;
                    return (s === nodeId || t === nodeId) ? 1 : 0.05;
                })
                .attr('stroke', l => {
                    const s = l.source.id || l.source;
                    const t = l.target.id || l.target;
                    if (t === nodeId) return '#06b6d4'; // Incoming placement
                    if (s === nodeId) return '#a78bfa'; // Outgoing hiring
                    return 'rgba(99, 102, 241, 0.28)';
                })
                .attr('marker-end', l => {
                    const s = l.source.id || l.source;
                    const t = l.target.id || l.target;
                    return (s === nodeId || t === nodeId) ? 'url(#arrow-active)' : 'url(#arrow)';
                });

            label.attr('opacity', d => 
                (d.id === nodeId || connectedSources.has(d.id) || connectedTargets.has(d.id)) ? 1 : 0.15
            );
        }
    }

    function resetGraphHighlight() {
        if (!graphNodesGroup || !graphLinksGroup) return;
        graphNodesGroup.attr('opacity', 1).attr('stroke', 'rgba(255, 255, 255, 0.85)').attr('stroke-width', 1.5);
        graphLinksGroup
            .attr('opacity', 1)
            .attr('stroke', 'rgba(99, 102, 241, 0.28)')
            .attr('marker-end', 'url(#arrow)');
        d3.selectAll('.labels text').attr('opacity', 1);
    }

    function highlightGraphNode(nodeId) {
        if (!graphNodesGroup) return;
        graphNodesGroup.each(function(d) {
            if (d.id === nodeId) {
                d3.select(this)
                    .attr('stroke', '#06b6d4')
                    .attr('stroke-width', 3.5);
            }
        });
    }

    function focusNodeInGraph(nodeId) {
        if (!graphSim || !graphSvg || !graphZoom) return;
        const node = graphSim.nodes().find(n => n.id === nodeId);
        if (!node) return;

        const container = document.getElementById('networkGraph');
        const width = container.clientWidth || 700;
        const height = container.clientHeight || 500;

        graphSvg.transition()
            .duration(750)
            .call(
                graphZoom.transform,
                d3.zoomIdentity.translate(width / 2 - node.x * 1.5, height / 2 - node.y * 1.5).scale(1.5)
            );

        highlightGraphNode(nodeId);
    }

    // ——— Drag Behavior ———
    function drag(simulation) {
        return d3.drag()
            .on('start', (event) => {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                event.subject.fx = event.subject.x;
                event.subject.fy = event.subject.y;
            })
            .on('drag', (event) => {
                event.subject.fx = event.x;
                event.subject.fy = event.y;
            })
            .on('end', (event) => {
                if (!event.active) simulation.alphaTarget(0);
                event.subject.fx = null;
                event.subject.fy = null;
            });
    }
})();
