export interface BsvMapDetail {
    automapper: boolean,
    createdAt: BsvInstant,
    curatedAt: BsvInstant,
    curator: BsvUserDetail,
    deletedAt: BsvInstant,
    description: string,
    id: string,
    lastPublishedAt: BsvInstant,
    metadata: BsvMapDetailMetadata,
    name: string,
    qualified: boolean,
    ranked: boolean,
    stats: BsvMapStats,
    tags: string[],
    updatedAt: BsvInstant,
    uploaded: BsvInstant,
    uploader: BsvUserDetail,
    versions: BsvMapVersion[],
}

export interface BsvInstant {
    epochSeconds: number,
    nanosecondsOfSecond: number,
    value: string
}

export interface BsvUserDetail {
    admin: boolean,
    avatar: string,
    curator: boolean,
    description: string,
    email: string,
    followData: BsvUserFollowData,
    hash: string,
    id: number,
    name: string,
    stats: BsvUserStats,
    testplay: boolean,
    type: string,
    uniqueSet: boolean,
    uploadLimit: number,
    verifiedMapper: boolean
}

export interface BsvUserFollowData {
    followers: number,
    following: boolean,
    follows: number
}

export interface BsvUserStats {
    avgBpm: number,
    avgDuration: number,
    avgScore: number,
    diffStats: BsvUserDiffStats,
    firstUpload: BsvInstant,
    lastUpload: BsvInstant,
    rankedMaps: number,
    totalDownvotes: number,
    totalMaps: number,
    totalUpvotes: number
}

export interface BsvUserDiffStats {
    easy: number,
    expert: number,
    expertPlus: number,
    hard: number,
    normal: number,
    total: number
}

export interface BsvMapDetailMetadata {
    bpm: number,
    duration: number,
    levelAuthorName: string,
    songAuthorName: string,
    songName: string,
    songSubName: string
}

export interface BsvMapStats {
    downloads: number,
    downvotes: number,
    plays: number,
    score: number,
    scoreOneDP: number,
    upvotes: number,
}

export interface BsvMapVersion {
    coverURL: string,
    createdAt: BsvInstant,
    diffs: BsvMapDifficulty[],
    downloadURL: string,
    feedback: string,
    hash: string,
    key: string,
    previewURL: string,
    sageScore: number,
    scheduledAt: BsvInstant,
    state: string,
    testplayAt: BsvInstant,
    testplays: BsvMapTestplay[],
}

export interface BsvMapTestplay {
    createdAt: BsvInstant,
    feedback: string,
    feedbackAt: BsvInstant,
    user: BsvUserDetail,
    video: string
}

export interface BsvMapDifficulty {
    bombs: number,
    characteristic: string,
    chroma: boolean,
    cinema: boolean,
    difficulty: string,
    events: number,
    length: number,
    maxScore: number,
    me: boolean,
    ne: boolean,
    njs: number,
    notes: number,
    nps: number,
    obstacles: number,
    offset: number,
    paritySummary: BsvMapParitySummary,
    seconds: number,
    stars: number
}

export interface BsvMapParitySummary {
    errors: number,
    resets: number,
    warns: number,
}