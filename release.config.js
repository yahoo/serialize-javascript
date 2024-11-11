const preset = 'conventionalcommits';

/**
 * semantic-release plugin to analyze commits with conventional-changelog
 * https://github.com/semantic-release/commit-analyzer
 */
const commitAnalyzerConfig = {
    preset,
};

/**
 * semantic-release plugin to generate changelog content with conventional-changelog
 * https://github.com/semantic-release/release-notes-generator
 */
const releaseNotesGeneratorConfig = {
    preset,
};

/**
 * semantic-release plugin to publish a GitHub release and comment on released Pull Requests/Issues.
 * https://github.com/semantic-release/github
 */
const githubConfig = {
    successComment: false,
    failComment: false,
    labels: false,
    releasedLabels: false,
};

/**
 * @type {import('semantic-release').GlobalConfig}
 */
module.exports = {
    branches: ['master'],
    tagFormat: 'v${version}',
    plugins: [
        ['@semantic-release/commit-analyzer', commitAnalyzerConfig],
        ['@semantic-release/release-notes-generator', releaseNotesGeneratorConfig],
        ['@semantic-release/npm'],
        ['@semantic-release/github', githubConfig],
    ],
};
