import { BSVersion } from "../../../main/services/bs-version-manager.service"
import { ReducerAction } from "../store"

const INITIAL_STATE = {
    installedVersions: [] as BSVersion[] 
}

function installedBSReducer(state = INITIAL_STATE, action: ReducerAction<BSVersion|BSVersion[]>){
    switch(action.type){
        case 'INSTALLED_BS_ADD_ALL': {
            if(!action.payload){ return state; }
            const payload = action.payload as BSVersion[];
            return { ...state, installedVersions: [...state.installedVersions, ...payload] };
        }
        case 'INSTALLED_BS_ADD':{
            if(!action.payload){ return state; }
            const payload = action.payload as BSVersion;
            return { ...state, installedVersions: [...state.installedVersions, payload]}
        }
    }

    return state;
}

export default installedBSReducer;