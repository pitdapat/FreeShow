export const UPDATE_REPOSITORY = {
    owner: "pitdapat",
    repo: "FreeShow"
} as const

export const UPDATE_RELEASES_API = `https://api.github.com/repos/${UPDATE_REPOSITORY.owner}/${UPDATE_REPOSITORY.repo}/releases`
export const UPDATE_RELEASES_URL = `https://github.com/${UPDATE_REPOSITORY.owner}/${UPDATE_REPOSITORY.repo}/releases`
