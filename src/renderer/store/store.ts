import { configureStore } from "@reduxjs/toolkit";
import installedBSReducer from './reducers/bs-versions-installed.reducer'

const store = configureStore({
    reducer:{
        installedBSReducer,
    }
});

export default store;

export interface ReducerAction<T> {
    type: string,
    payload?: T
}