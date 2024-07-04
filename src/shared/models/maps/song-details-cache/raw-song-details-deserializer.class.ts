import { MapStyle, MapTag, MapType } from "../beat-saver.model";
import { RawDifficulty, RawDifficultyCharacteristic, RawDifficultyLabel, RawMapTag, RawSongDetails, UploaderRef, UploadersList } from "./raw-song-details-cache.model";
import { SongDetailDiffCharactertistic, SongDetails, SongDiffName, SongDifficulty, SongUploader } from "./song-details-cache.model";

export abstract class RawSongDetailsDeserializer {

    public static uploaderList: UploadersList = { names: [], ids: [] };
    public static difficultyLabels: string[] = [];

    private static readonly HASH_CHARS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];

    private constructor() {}

    public static setUploadersList(uploadersList: UploadersList): void {
        this.uploaderList = uploadersList;
    }

    public static setDifficultyLabels(difficultyLabels: string[]): void {
        this.difficultyLabels = difficultyLabels;
    }

    private static deserializeRawTag(rawTag: RawMapTag): MapTag {
        switch (rawTag) {
            case RawMapTag.DANCE: return MapStyle.Dance;
            case RawMapTag.SWING: return MapStyle.Swing;
            case RawMapTag.NIGHTCORE: return MapStyle.Nightcore;
            case RawMapTag.FOLK: return MapStyle.Folk;
            case RawMapTag.FAMILY: return MapStyle.Family;
            case RawMapTag.AMBIENT: return MapStyle.Ambient;
            case RawMapTag.FUNK: return MapStyle.Funk;
            case RawMapTag.JAZZ: return MapStyle.Jazz;
            case RawMapTag.SOUL: return MapStyle.Soul;
            case RawMapTag.SPEEDCORE: return MapStyle.Speedcore;
            case RawMapTag.PUNK: return MapStyle.Punk;
            case RawMapTag.RB: return MapStyle.Rb;
            case RawMapTag.HOLIDAY: return MapStyle.Holiday;
            case RawMapTag.VOCALOID: return MapStyle.Vocaloid;
            case RawMapTag.J_ROCK: return MapStyle.JRock;
            case RawMapTag.TRANCE: return MapStyle.Trance;
            case RawMapTag.DRUMBASS: return MapStyle.DrumBass;
            case RawMapTag.COMEDY: return MapStyle.Comedy;
            case RawMapTag.INSTRUMENTAL: return MapStyle.Instrumental;
            case RawMapTag.HARDCORE: return MapStyle.Hardcore;
            case RawMapTag.K_POP: return MapStyle.KPop;
            case RawMapTag.INDIE: return MapStyle.Indie;
            case RawMapTag.TECHNO: return MapStyle.Techno;
            case RawMapTag.HOUSE: return MapStyle.House;
            case RawMapTag.GAME: return MapStyle.Game;
            case RawMapTag.FILM: return MapStyle.Film;
            case RawMapTag.ALT: return MapStyle.Alt;
            case RawMapTag.DUBSTEP: return MapStyle.Dubstep;
            case RawMapTag.METAL: return MapStyle.Metal;
            case RawMapTag.ANIME: return MapStyle.Anime;
            case RawMapTag.HIPHOP: return MapStyle.Hiphop;
            case RawMapTag.J_POP: return MapStyle.JPop;
            case RawMapTag.ROCK: return MapStyle.Rock;
            case RawMapTag.POP: return MapStyle.Pop;
            case RawMapTag.ELECTRONIC: return MapStyle.Electronic;
            case RawMapTag.CLASSICAL_ORCHESTRAL: return MapStyle.ClassicalOrchestral;
            case RawMapTag.ACCURACY: return MapType.Accuracy;
            case RawMapTag.BALANCED: return MapType.Balanced;
            case RawMapTag.CHALLENGE: return MapType.Challenge;
            case RawMapTag.DANCESTYLE: return MapType.Dancestyle;
            case RawMapTag.FITNESS: return MapType.Fitness;
            case RawMapTag.SPEED: return MapType.Speed;
            case RawMapTag.TECH: return MapType.Tech;
            default: return undefined;
        }
    }

    private static deserializeRawTags(rawTags: RawMapTag[] = []): MapTag[] {
        return rawTags.map(rawTag => this.deserializeRawTag(rawTag)).filter(Boolean);
    }

    private static deserializeRawDifficultyCharacteristic(rawCharacteristic: RawDifficultyCharacteristic): SongDetailDiffCharactertistic {
        switch (rawCharacteristic) {
            case RawDifficultyCharacteristic.STANDARD: return SongDetailDiffCharactertistic.Standard;
            case RawDifficultyCharacteristic.ONE_SABER: return SongDetailDiffCharactertistic.OneSaber;
            case RawDifficultyCharacteristic.NO_ARROWS: return SongDetailDiffCharactertistic.NoArrows;
            case RawDifficultyCharacteristic.LAWLESS: return SongDetailDiffCharactertistic.Lawless;
            case RawDifficultyCharacteristic.LIGHTSHOW: return SongDetailDiffCharactertistic.Lightshow;
            case RawDifficultyCharacteristic.LEGACY: return SongDetailDiffCharactertistic.Legacy;
            case RawDifficultyCharacteristic.NINETY_DEGREE: return SongDetailDiffCharactertistic._90Degree;
            case RawDifficultyCharacteristic.THREESIXTY_DEGREE: return SongDetailDiffCharactertistic._360Degree;
            default: return SongDetailDiffCharactertistic.Standard;
        }
    }

    private static deserializeRawDifficultyLabel(rawLabel: RawDifficultyLabel): SongDiffName {
        switch (rawLabel) {
            case RawDifficultyLabel.EASY: return SongDiffName.Easy;
            case RawDifficultyLabel.NORMAL: return SongDiffName.Normal;
            case RawDifficultyLabel.HARD: return SongDiffName.Hard;
            case RawDifficultyLabel.EXPERT: return SongDiffName.Expert;
            case RawDifficultyLabel.EXPERT_PLUS: return SongDiffName.ExpertPlus;
            default: return SongDiffName.ExpertPlus;
        }
    }

    private static deserializeRawDifficulty(rawDifficulty: RawDifficulty): SongDifficulty {
        return {
            difficulty: this.deserializeRawDifficultyLabel(rawDifficulty.difficulty),
            characteristic: this.deserializeRawDifficultyCharacteristic(rawDifficulty.characteristic),
            label: RawSongDetailsDeserializer.difficultyLabels[rawDifficulty.labelIndex],
            stars: Math.round(rawDifficulty.starsT100) / 100,
            starsBL: Math.round(rawDifficulty.starsBlT100) / 100,
            njs: Math.round(rawDifficulty.njsT100) / 100,
            nps: Math.round(rawDifficulty.npsT100) / 100,
            offset: Math.round(rawDifficulty.offsetT100) / 100,
            chroma: rawDifficulty.chroma,
            cinema: rawDifficulty.cinema,
            me: rawDifficulty.me,
            ne: rawDifficulty.ne,
            bombs: rawDifficulty.bombs,
            notes: rawDifficulty.notes,
            obstacles: rawDifficulty.obstacles
        };
    }

    private static deserializeRawDifficulties(rawDifficulties: RawDifficulty[] = []): SongDifficulty[] {
        return rawDifficulties.map(rawDifficulty => this.deserializeRawDifficulty(rawDifficulty));
    }

    private static deserializeRawUploader(uploaderRef: UploaderRef): SongUploader {

        return {
            name: RawSongDetailsDeserializer.uploaderList.names[uploaderRef.uploaderRefIndex],
            id: RawSongDetailsDeserializer.uploaderList.ids[uploaderRef.uploaderRefIndex],
            verified: uploaderRef.verified
        };
    }

    /**
     * The map ID has been serialized as a number from its HEX value, so we need to deserialize it back to a string.
     */
    private static deserializeMapId(rawMapId: number): string {
        return rawMapId.toString(16);
    }

    private static deserializeHashIndices(hashIndices: number[]): string {
        return hashIndices.map(index => this.HASH_CHARS[index]).join("");
    }

    /**
     * Deserialize the raw song details to the song details model.
     * @param {RawSongDetails} rawSongDetails the raw song details to deserialize (normally get from the proto message)
     * @returns {SongDetails} the deserialized song details
     * @throws Can throw an error if the raw song details is invalid or missing required fields
     */
    public static deserialize(rawSongDetails: RawSongDetails): SongDetails {
        if (!rawSongDetails) {
            throw new Error("Invalid raw song details");
        }

        return {
            id: this.deserializeMapId(rawSongDetails.idInt),
            hash: this.deserializeHashIndices(rawSongDetails.hashIndices),
            name: rawSongDetails.name,
            duration: rawSongDetails.duration,
            uploader: this.deserializeRawUploader(rawSongDetails.uploaderRef),
            uploadedAt: rawSongDetails.uploadedAt,
            tags: this.deserializeRawTags(rawSongDetails.tags),
            ranked: rawSongDetails.ranked,
            qualified: rawSongDetails.qualified,
            curated: rawSongDetails.curated,
            blRanked: rawSongDetails.blRanked,
            blQualified: rawSongDetails.blQualified,
            upVotes: rawSongDetails.upVotes,
            downVotes: rawSongDetails.downVotes,
            downloads: rawSongDetails.downloads,
            automapper: rawSongDetails.automapper,
            difficulties: this.deserializeRawDifficulties(rawSongDetails.difficulties)
        };
    }

}
