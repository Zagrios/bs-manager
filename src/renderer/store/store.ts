import { configureStore } from "@reduxjs/toolkit";
import installedBSReducer from './reducers/bs-versions-installed.reducer'
import availableBsReducer from './reducers/bs-versions-available.reducer'

const store = configureStore({
    reducer:{
        installedBSReducer, availableBsReducer
    }
});

export default store;

export interface ReducerAction<T> {
    type: string,
    payload?: T
}