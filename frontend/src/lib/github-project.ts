// Keep the external entry and public statistics on the same repository.
export const githubProject = {
  repository: 'YippeeYi/class',
  get url() {
    return `https://github.com/${this.repository}`
  },
  get apiUrl() {
    return `https://api.github.com/repos/${this.repository}`
  },
}
