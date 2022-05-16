import { BSVersion } from "../../../main/services/bs-version-manager.service"
import { ReducerAction } from "../store"

const INITIAL_STATE = {
    availableVersions: [] as BSVersion[] 
}

function availableBsReducer(state = INITIAL_STATE, action: ReducerAction<BSVersion[]>){
    switch(action.type){
        case 'AVAILABLE_BS_INIT': {
            if(!action.payload){ return state; }
            const payload = action.payload as BSVersion[];
            return { ...state, availableVersions: [...state.availableVersions, ...payload] };
        }
    }

    return state;
}

export default availableBsReducer;