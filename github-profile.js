/**
 * GitHub Profile Module
 *
 * Fetches public repos, user stats, and recent activity
 * from the GitHub API (no auth required for public data).
 */

const GitHubProfile = (() => {
    const USERNAME = 'obfuscated-tm';
    const API = 'https://api.github.com';

    let container;

    /* ── Helpers ── */
    function esc(s) {
        const d = document.createElement('div');
        d.textContent = s || '';
        return d.innerHTML;
    }

    function timeAgo(dateStr) {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        if (days < 30) return `${days}d ago`;
        const months = Math.floor(days / 30);
        return `${months}mo ago`;
    }

    function langColor(lang) {
        const colors = {
            JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
            HTML: '#e34c26', CSS: '#563d7c', Java: '#b07219', C: '#555555',
            'C++': '#f34b7d', 'C#': '#178600', Go: '#00ADD8', Rust: '#dea584',
            Ruby: '#701516', PHP: '#4F5D95', Swift: '#F05138', Kotlin: '#A97BFF',
            Dart: '#00B4AB', Shell: '#89e051', Lua: '#000080', Vue: '#41b883',
            Svelte: '#ff3e00', SCSS: '#c6538c', Jupyter: '#DA5B0B',
        };
        return colors[lang] || '#8b949e';
    }

    /* ── Fetchers ── */
    async function fetchJSON(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`GitHub API: ${res.status}`);
        return res.json();
    }

    /* ── Init ── */
    async function init(containerId) {
        container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
      <div class="gh-loading">
        <div class="gh-spinner"></div>
        <p>Fetching GitHub data…</p>
      </div>`;

        try {
            const [user, repos, events] = await Promise.all([
                fetchJSON(`${API}/users/${USERNAME}`),
                fetchJSON(`${API}/users/${USERNAME}/repos?sort=updated&per_page=100`),
                fetchJSON(`${API}/users/${USERNAME}/events/public?per_page=50`),
            ]);

            render(user, repos, events);
        } catch (err) {
            console.error(err);
            container.innerHTML = `
        <div class="gh-error">
          <p>Could not load GitHub data.</p>
          <p class="gh-error__detail">${esc(err.message)}</p>
          <a href="https://github.com/${USERNAME}" target="_blank" class="btn btn--secondary">Visit Profile ↗</a>
        </div>`;
        }
    }

    /* ── Render Everything ── */
    function render(user, repos, events) {
        // Compute stats
        const totalStars = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
        const totalForks = repos.reduce((sum, r) => sum + (r.forks_count || 0), 0);
        // Languages computation removed per request

        // Compute commit activity from push events
        const pushEvents = events.filter(e => e.type === 'PushEvent');
        const totalRecentCommits = pushEvents.reduce((sum, e) => sum + (e.payload.commits ? e.payload.commits.length : 0), 0);

        // Activity by day of week
        // Commits by day removed per request

        // Heatmap computation removed per request

        // Sort repos for display: pinned feeling (most stars first, then recent)
        const sortedRepos = [...repos]
            .filter(r => !r.fork)
            .sort((a, b) => b.stargazers_count - a.stargazers_count)
            .slice(0, 12);

        // Build HTML
        let html = '';

        // ── Profile Header
        html += `
      <div class="gh-header">
        <img class="gh-header__avatar" src="${user.avatar_url}" alt="${esc(user.login)}">
        <div class="gh-header__info">
          <h3 class="gh-header__name">${esc(user.name || user.login)}</h3>
          <a class="gh-header__username" href="${user.html_url}" target="_blank">@${esc(user.login)} ↗</a>
          ${user.bio ? `<p class="gh-header__bio">${esc(user.bio)}</p>` : ''}
        </div>
      </div>`;

        // ── Stats Cards
        html += `
      <div class="gh-stats">
        <div class="gh-stat">
          <span class="gh-stat__value">${user.public_repos}</span>
          <span class="gh-stat__label">Repos</span>
        </div>
        <div class="gh-stat">
          <span class="gh-stat__value">${totalStars}</span>
          <span class="gh-stat__label">Stars</span>
        </div>
        <div class="gh-stat">
          <span class="gh-stat__value">${totalForks}</span>
          <span class="gh-stat__label">Forks</span>
        </div>
        <div class="gh-stat">
          <span class="gh-stat__value">${user.followers}</span>
          <span class="gh-stat__label">Followers</span>
        </div>
        <div class="gh-stat">
          <span class="gh-stat__value">${totalRecentCommits}</span>
          <span class="gh-stat__label">Recent Commits</span>
        </div>
      </div>`;

        // Top languages rendering removed

        // Heatmap rendering removed per request

        // Coding days chart rendering removed

        // ── Repositories
        html += `
      <div class="gh-section">
        <h4 class="gh-section__title">Repositories</h4>
        <div class="gh-repos">
          ${sortedRepos.map(r => `
            <a class="gh-repo" href="${r.html_url}" target="_blank" rel="noopener">
              <div class="gh-repo__top">
                <span class="gh-repo__name">${esc(r.name)}</span>
                ${r.language ? `<span class="gh-repo__lang"><span class="gh-lang-dot" style="background:${langColor(r.language)}"></span>${esc(r.language)}</span>` : ''}
              </div>
              ${r.description ? `<p class="gh-repo__desc">${esc(r.description)}</p>` : ''}
              <div class="gh-repo__meta">
                <span>⭐ ${r.stargazers_count}</span>
                <span>🍴 ${r.forks_count}</span>
                <span>${timeAgo(r.updated_at)}</span>
              </div>
            </a>
          `).join('')}
        </div>
      </div>`;

        // Recent activity rendering removed

        container.innerHTML = html;
    }

    return { init };
})();
