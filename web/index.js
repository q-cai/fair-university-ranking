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

    let DATA = null;

    // ——— Load data.json ———
    fetch('data.json')
        .then(r => {
            if (!r.ok) throw new Error('Failed to load data.json');
            return r.json();
        })
        .then(data => {
            DATA = data;
            populateStats(data);
            renderTable(data.rankings, 'all');
            renderNetwork(data.network, data.rankings);
            setupToggles(data.rankings);
        })
        .catch(err => {
            console.error(err);
            document.getElementById('rankingsBody').innerHTML =
                `<tr><td colspan="6" style="color:var(--red);padding:2rem">
                    ❌ Could not load data.json.<br>
                    Run <code>python3 xrank.py</code> first, then serve from the project root:<br>
                    <code>cd university_ranking && python3 -m http.server 8080</code><br>
                    Open <code>http://localhost:8080/web/</code>
                </td></tr>`;
        });

    // ——— Stats Cards ———
    function populateStats(data) {
        document.getElementById('statTotal').textContent = data.rankings.length;
        document.getElementById('statEdges').textContent = data.network.links.length;
        document.getElementById('statTop').textContent =
            data.rankings.length > 0 ? data.rankings[0].university.replace(/\s*\(.*?\)\s*/g, '') : '—';
    }

    // ——— Table Rendering ———
    function renderTable(rankings, filter) {
        const tbody = document.getElementById('rankingsBody');
        tbody.innerHTML = '';

        let filtered = rankings;
        if (filter === 'us') filtered = rankings.filter(r => r.country === 'United States');
        else if (filter === 'intl') filtered = rankings.filter(r => r.country !== 'United States');

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="padding:2rem;color:var(--text-muted)">No data for this filter</td></tr>';
            return;
        }

        const maxScore = Math.max(...filtered.map(r => r.score));

        filtered.forEach(r => {
            const delta = r.qs_rank - r.xrank;
            let deltaClass = 'same', deltaText = '—';
            if (delta > 0) { deltaClass = 'up'; deltaText = `▲${delta}`; }
            else if (delta < 0) { deltaClass = 'down'; deltaText = `▼${Math.abs(delta)}`; }

            const barPct = (r.score / maxScore * 100).toFixed(1);
            const flag = FLAGS[r.country] || '🌍';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="color:var(--accent-1)">${r.xrank}</td>
                <td><span class="delta ${deltaClass}">${deltaText}</span></td>
                <td>${r.university}</td>
                <td><span class="country-tag">${flag} ${r.country}</span></td>
                <td>${r.qs_rank}</td>
                <td>${r.total_placed}</td>
                <td>
                    <div class="score-cell">
                        <span class="score-num">${r.score.toFixed(2)}</span>
                        <div class="score-bar-bg"><div class="score-bar-fill" style="width:${barPct}%"></div></div>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // ——— Toggle Buttons ———
    function setupToggles(rankings) {
        const btns = { btnAll: 'all', btnUS: 'us', btnIntl: 'intl' };
        Object.entries(btns).forEach(([id, filter]) => {
            document.getElementById(id).addEventListener('click', function () {
                document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                renderTable(rankings, filter);
            });
        });
    }

    // ——— D3 Network Graph ———
    function renderNetwork(network, rankings) {
        const container = document.getElementById('networkGraph');
        const width = container.clientWidth || 700;
        const height = container.clientHeight || 500;

        // Build a score lookup
        const scoreMap = {};
        rankings.forEach(r => { scoreMap[r.larremore_name] = r.score; });
        const maxScore = Math.max(...Object.values(scoreMap));

        const svg = d3.select('#networkGraph')
            .append('svg')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');

        // Defs for gradient
        const defs = svg.append('defs');
        const grad = defs.append('linearGradient').attr('id', 'linkGrad');
        grad.append('stop').attr('offset', '0%').attr('stop-color', '#6366f1').attr('stop-opacity', 0.4);
        grad.append('stop').attr('offset', '100%').attr('stop-color', '#8b5cf6').attr('stop-opacity', 0.15);

        // Build sim data
        const nodes = network.nodes.map(n => ({ ...n }));
        const links = network.links.map(l => ({ ...l }));

        const maxWeight = Math.max(...links.map(l => l.weight));

        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(120))
            .force('charge', d3.forceManyBody().strength(-350))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(d => nodeRadius(d) + 5));

        function nodeRadius(d) {
            const s = scoreMap[d.id] || 1;
            return 6 + (s / maxScore) * 18;
        }

        // Links
        const link = svg.append('g')
            .selectAll('line')
            .data(links)
            .join('line')
            .attr('stroke', 'url(#linkGrad)')
            .attr('stroke-width', d => 0.5 + (d.weight / maxWeight) * 4)
            .attr('stroke-linecap', 'round');

        // Nodes
        const node = svg.append('g')
            .selectAll('circle')
            .data(nodes)
            .join('circle')
            .attr('r', d => nodeRadius(d))
            .attr('fill', d => {
                const s = scoreMap[d.id] || 0;
                const t = s / maxScore;
                return d3.interpolateViridis(0.3 + t * 0.6);
            })
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5)
            .style('cursor', 'grab')
            .call(drag(simulation));

        // Labels
        const label = svg.append('g')
            .selectAll('text')
            .data(nodes)
            .join('text')
            .attr('text-anchor', 'middle')
            .attr('dy', d => nodeRadius(d) + 14)
            .attr('fill', '#94a3b8')
            .attr('font-size', '10px')
            .attr('font-family', 'Inter, sans-serif')
            .attr('pointer-events', 'none')
            .text(d => d.id);

        // Tooltip
        const tooltip = document.getElementById('tooltip');

        node.on('mouseenter', (event, d) => {
            const s = scoreMap[d.id];
            const r = rankings.find(x => x.larremore_name === d.id);
            tooltip.innerHTML = `
                <strong>${r ? r.university : d.id}</strong><br>
                XRank: <strong>${r ? r.xrank : '—'}</strong> · QS: ${r ? r.qs_rank : '—'}<br>
                Score: ${s ? s.toFixed(2) : '—'}
            `;
            tooltip.classList.add('visible');
        });

        node.on('mousemove', (event) => {
            tooltip.style.left = (event.clientX + 14) + 'px';
            tooltip.style.top = (event.clientY - 10) + 'px';
        });

        node.on('mouseleave', () => {
            tooltip.classList.remove('visible');
        });

        // Tick
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
