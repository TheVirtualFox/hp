const {WebSocketManager} = require('./WebSocketManager');

const preset = {
    pump: [
        {on: 7, off: 12},
        {on: 57, off: 110},
    ],
    light: [
        {on: 7, off: 12},
        {on: 57, off: 110},
    ],
    air: [],
    fan: []
};


class TimeManager {
    secondsOfDay = 0;
    onTimestampChanged = null;
    constructor(onTimestampChanged) {
        this.onTimestampChanged = onTimestampChanged;
    }

    setTimestamp(timestamp) {
        this.secondsOfDay = timestamp;
        this.onTimestampChanged(timestamp);
    }

    setSecondsOfDay(secondsOfDay) {
        this.secondsOfDay = secondsOfDay;
    }

    addSecondsOfDay() {
        this.secondsOfDay++;
    };

    getSecondsOfDay() {
        return this.secondsOfDay;
    }

    getTimestamp() {
        return this.secondsOfDay;
    }

}

class ControlPanel {
    isManualControl = false;
    isPumpOn = false;
    isLightOn = false;
    isAirOn = false;
    isFanOn = false;
    onControlPanelStateChanged = null;
    constructor(onControlPanelStateChanged) {
        this.onControlPanelStateChanged = onControlPanelStateChanged;
    }

    setControlPanelState(state) {
        let isChanged = false;
        if (this.isManualControl !== state.isManualControl) {
            isChanged = true;
        }
        this.isManualControl = state.isManualControl;
        if (!this.isManualControl) {
            if (this.isPumpOn || this.isLightOn || this.isAirOn || this.isFanOn) {
                isChanged = true;
            }

            this.isPumpOn = false;
            this.isLightOn = false;
            this.isAirOn = false;
            this.isFanOn = false;
        } else {
            if (typeof state.pump !== 'undefined') {
                if (this.isPumpOn !== state.pump) { isChanged = true; }
                this.isPumpOn = state.pump;
            }
            if (typeof state.light !== 'undefined') {
                if (this.isLightOn !== state.light) { isChanged = true; }
                this.isLightOn = state.light;
            }
            if (typeof state.air !== 'undefined') {
                if (this.isAirOn !== state.air) {
                    isChanged = true;
                }
                this.isAirOn = state.air;
            }
            if (typeof state.fan !== 'undefined') {
                if (this.isFanOn !== state.fan) {
                    isChanged = true;
                }
                this.isFanOn = state.fan;
            }
        }
        if (isChanged) {
            this.onControlPanelStateChanged(this.getState());
        }
    }

    getIsManualControl() {
        return this.isManualControl;
    }

    getState() {
        return {
            isManualControl: this.isManualControl,
            pump: this.isPumpOn,
            light: this.isLightOn,
            air: this.isAirOn,
            fan: this.isFanOn
        };
    }
}

class PresetManager {
    //
    currentPreset = null;
    onCurrentPresetChanged = null;
    onPresetListChanged = null;

    presetsList = [];

    constructor(onCurrentPresetChanged, onPresetListChanged) {
        this.onCurrentPresetChanged = onCurrentPresetChanged;
        this.onPresetListChanged = onPresetListChanged;
    }

    getCurrentPreset() {
        return this.currentPreset;
    }

    setPresetList(presetsList) {
        this.presetsList = presetsList;
        this.onPresetListChanged(this.getPresetsList());
    }

    setCurrentPreset({id}) { // переименовать в toggle и добавить setCurrentPreset
        if (this.currentPreset?.id === id) {
            this.currentPreset = null;
        } else {
            const preset = this.presetsList.find((p) => p.id === id);
            this.currentPreset = preset;
            this.currentPreset.activeTimestamp = this.getTimestamp();
        }
        this.onCurrentPresetChanged(this.currentPreset);
        this.onPresetListChanged(this.getPresetsList());
    }

    savePreset(preset) { // сохранить или обновить
        const savedPreset = this.getPresetsList().find(({id}) => id === preset?.id);
        const isNew = !savedPreset;
        preset.timestamp = this.getTimestamp();
        if (isNew) {
            this.setPresetList([...this.presetsList, preset]);
        } else {
            const updated = this.presetsList.map((p) => p.id === preset?.id ? preset : p);
            this.setPresetList(updated);
            if (this.getCurrentPreset()?.id === savedPreset?.id) {
                this.currentPreset = preset;
                this.currentPreset.activeTimestamp = this.getTimestamp();
                this.onCurrentPresetChanged(this.getCurrentPreset());
            }
        }
    }

    getPresetsList() {
        return this.presetsList.map(({label, timestamp, id}) => ({isActive: id === this.getCurrentPreset()?.id, label, timestamp, id}));
    }

    getTimestamp() {
        const d = new Date();
        return Math.floor(d.getTime() / 1000);
    }

    getPreset({id}) {
        return this.presetsList.find(({id: idid}) => idid === id);
    }

    deletePreset({id}) {
        // проверка на удаление current
        if (this.getCurrentPreset()?.id === id) {
            this.currentPreset = null;
            this.onCurrentPresetChanged(null);
        }
        this.setPresetList(this.presetsList.filter(({id: idid}) => id !== idid));
    }

    // setCurrentPreset(presetId) {
    //     ;
    // }
}

class Relay {
    pin = null;
    isOn = false;
    label = null;

    constructor(label, pin, isOn) {
        this.pin = pin;
        this.isOn = isOn;
        this.label = label;
    }

    on() {
        if (this.isOn) {
            return false;
        }
        this.isOn = true;
        return true;
    }

    off() {
        if (!this.isOn) {
            return false;
        }
        this.isOn = false;
        return true;
    }

    getIsOn() {
        return this.isOn;
    }
}

class RelayManager {
    pumpRelay = null;
    lightRelay = null;
    airRelay = null;
    fanRelay = null;

    onRelaysStateChanged = null;

    constructor(onRelaysStateChanged) {
        this.pumpRelay = new Relay('Насос', 1, false);
        this.lightRelay = new Relay('Свет', 2, false);
        this.airRelay = new Relay('Аэратор', 3, false);
        this.fanRelay = new Relay('Вентилятор', 4, false);
        this.onRelaysStateChanged = onRelaysStateChanged;
    }

    onPresetControl(secondsOfDay, currentPreset) {
        const pump = currentPreset?.pump.some(({on, off}) => secondsOfDay >= on && secondsOfDay <= off);
        const light = currentPreset?.light.some(({on, off}) => secondsOfDay >= on && secondsOfDay <= off);
        const air = currentPreset?.air.some(({on, off}) => secondsOfDay >= on && secondsOfDay <= off);
        const fan = currentPreset?.fan.some(({on, off}) => secondsOfDay >= on && secondsOfDay <= off);

        this.setState({ pump, light, air, fan });
    }

    onTimeChange(secondsOfDay, currentPreset) {
        this.onPresetControl(secondsOfDay, currentPreset);
    }

    getState() {
        return {
            pump: this.pumpRelay.getIsOn(),
            light: this.lightRelay.getIsOn(),
            air: this.airRelay.getIsOn(),
            fan: this.fanRelay.getIsOn(),
        };
    }

    setState({pump, light, air, fan}) {
        const isPumpChanged = pump ? this.pumpRelay.on() : this.pumpRelay.off();
        const isLightChanged = light ? this.lightRelay.on() : this.lightRelay.off();
        const isAirChanged = air ? this.airRelay.on() : this.airRelay.off();
        const isFanChanged = fan ? this.fanRelay.on() : this.fanRelay.off();

        const isChanged = isPumpChanged || isLightChanged || isAirChanged || isFanChanged;
        if (isChanged) {
            this.onRelaysStateChanged(this.getState());
        }
    }
}

const CLIENT_ACTIONS = {

    // SET_TIME: 'SET_TIME',
    SAVE_PRESET_REQ: 'SAVE_PRESET_REQ',
    DELETE_PRESET_REQ: 'DELETE_PRESET_REQ',
    GET_PRESET_REQ: 'GET_PRESET_REQ',

    SET_CONTROL_PANEL_REQ: 'SET_CONTROL_PANEL_REQ',
    SET_CURRENT_PRESET_REQ: 'SET_CURRENT_PRESET_REQ',
    SET_TIMESTAMP_REQ: 'SET_TIMESTAMP_REQ',
}

const SERVER_ACTIONS = {
    SAVE_PRESET_RES: 'SAVE_PRESET_RES',
    PRESETS_LIST_CHANGED: 'PRESETS_LIST_CHANGED',
    GET_PRESET_RES: 'GET_PRESET_RES',

    SET_CURRENT_PRESET_RES: 'SET_CURRENT_PRESET_RES',
    CURRENT_PRESET_UPDATED: 'CURRENT_PRESET_UPDATED',
    DELETE_PRESET_RES: 'DELETE_PRESET_RES',

    SET_CONTROL_PANEL_RES: 'SET_CONTROL_PANEL_RES',
    CONTROL_PANEL_CHANGED: 'CONTROL_PANEL_CHANGED',

    SET_TIMESTAMP_RES: 'SET_TIMESTAMP_RES',
    TIMESTAMP_CHANGED: 'TIMESTAMP_CHANGED',
    RELAYS_STATE_UPDATED: 'RELAYS_STATE_UPDATED',
    MINUTE_UPDATE: 'MINUTE_UPDATE',
    CLIENT_CONNECTED: 'CLIENT_CONNECTED'
}

class HydroponicManager {
    presetManager = null;
    relayManager = null;
    timeManager = null;
    webSocketManager = null;

    constructor() {
        this.timeManager = new TimeManager(this.onTimestampChanged.bind(this));
        this.webSocketManager = new WebSocketManager(this.onClientConnected.bind(this), this.onRequest.bind(this));
        this.presetManager = new PresetManager(this.onCurrentPresetChanged.bind(this), this.onPresetListChanged.bind(this));
        this.presetManager.setCurrentPreset(preset);
        this.controlPanel = new ControlPanel(this.onControlPanelChanged.bind(this));
        this.relayManager = new RelayManager(this.onRelaysStateChanged.bind(this));
        setInterval(this.onSecondChange.bind(this), 1000);
    }

    onClientConnected(ws) {
        const message = {
            action: SERVER_ACTIONS.CLIENT_CONNECTED,
            payload: {
                currentPreset: this.presetManager.getCurrentPreset(),
                controlPanel: this.controlPanel.getState(),
                relaysState: this.relayManager.getState(),
                timestamp: this.timeManager.getTimestamp(),
                presetsList: this.presetManager.getPresetsList()
            }
        };
        this.webSocketManager.send(ws, message);
    }

    onRequest({ws, clientId, message}) {
        const { action, requestId, payload } = message;

        switch (action) {
            case CLIENT_ACTIONS.SAVE_PRESET_REQ:
                // const payload = {id: '', title: "", desc: "", pump: [], light: [], air: [], fan: [] };
                this.presetManager.savePreset(payload);
                this.webSocketManager.send(ws, {
                    action: SERVER_ACTIONS.SAVE_PRESET_RES,
                    requestId,
                    payload,
                });
                break;
            case CLIENT_ACTIONS.SET_CURRENT_PRESET_REQ:
                // const payload = {id: ''};
                this.presetManager.setCurrentPreset(payload);
                this.webSocketManager.send(ws, {
                    action: SERVER_ACTIONS.SET_CURRENT_PRESET_RES,
                    requestId,
                    payload,
                });
                break;
            case CLIENT_ACTIONS.DELETE_PRESET_REQ:
                this.presetManager.deletePreset(payload);
                this.webSocketManager.send(ws, {
                    action: SERVER_ACTIONS.DELETE_PRESET_RES,
                    requestId,
                    payload,
                });
                break;
            case CLIENT_ACTIONS.SET_CONTROL_PANEL_REQ:
                this.controlPanel.setControlPanelState(payload);
                // const payload = {isManualControl: false, pump: false, light: false, air: false, fan: false};
                this.webSocketManager.send(ws, { // ?
                    action: SERVER_ACTIONS.SET_CONTROL_PANEL_RES,
                    requestId,
                    payload,
                });
                break;
            case CLIENT_ACTIONS.SET_TIMESTAMP_REQ:
                const {timestamp} = payload;
                this.timeManager.setTimestamp(timestamp);

                this.webSocketManager.send(ws, { // ?
                    action: SERVER_ACTIONS.SET_TIMESTAMP_RES,
                    requestId,
                    payload,
                });
                break;
            case CLIENT_ACTIONS.GET_PRESET_REQ:
                this.webSocketManager.send(ws, { // ?
                    action: SERVER_ACTIONS.GET_PRESET_RES,
                    requestId,
                    payload: this.presetManager.getPreset(payload)
            // {
            //             id: '777', label: "777 7", desc: "7777777", pump: [{on: 12, off: 777}, {on: 7777, off: 77777}], light: [{on: 2, off: 777}], air: [], fan: []
            //         },
                });
                break;
            default:
                return this.webSocketManager.send(ws, {
                    action: 'error',
                    requestId,
                    payload: { message: `Неизвестный тип запроса: ${action}` },
                });
        }
    }
    // при изменении списка пресетов
    onPresetListChanged(presets) {
        this.webSocketManager.broadcast({
            action: SERVER_ACTIONS.PRESETS_LIST_CHANGED,
            payload: presets, // новый список пресетов
        });
    }

    // и изменении текущего пресета
    onCurrentPresetChanged(preset) {
        const secondsOfDay = this.timeManager.getSecondsOfDay();
        console.log(secondsOfDay,'обновление пресета', preset);
        this.webSocketManager.broadcast({
            action: SERVER_ACTIONS.CURRENT_PRESET_UPDATED,
            payload: preset,
        });
    }

    //  при изменения состояния панели управления
    onControlPanelChanged(controlPanel) {
        const {isManualControl, ...state} = controlPanel;
        console.log("обновление панели управле", controlPanel);
        if (isManualControl) {
            this.relayManager.setState(state);
        }

        this.webSocketManager.broadcast({
            action: SERVER_ACTIONS.CONTROL_PANEL_CHANGED,
            payload: controlPanel, // новое состояние панели управления
        });
    }

    // при обновлении состояния реле
    onRelaysStateChanged(state) {
        console.log("обновление реле", state);
        this.webSocketManager.broadcast({
            action: SERVER_ACTIONS.RELAYS_STATE_UPDATED,
            payload: state, // новый список пресетов
        });
    }

    // вызывается каждую минуту для оповещения клиентов
    onMinuteChanged(timestamp) {
        console.log("обновление времени", timestamp);
        this.webSocketManager.broadcast({
            action: SERVER_ACTIONS.MINUTE_UPDATE,
            payload: {timestamp}, // новый список пресетов
        });
    }

    // было установленно новое значение времени
    onTimestampChanged(timestamp) { // обновление времени
        console.log("обновление времени", timestamp);
        this.webSocketManager.broadcast({
            action: SERVER_ACTIONS.TIMESTAMP_CHANGED,
            payload: {timestamp}, // новое время
        });
    }

    // цикл по секундам для обновление реле и датчиков
    onSecondChange() {
        const secondsOfDay = this.timeManager.getSecondsOfDay();
        if (!this.controlPanel.getIsManualControl()) {
            this.relayManager.onTimeChange(secondsOfDay, this.presetManager.getCurrentPreset());
        }
        if (secondsOfDay % 60 === 0) {
            this.onMinuteChanged(this.timeManager.getTimestamp());
        }
        this.timeManager.addSecondsOfDay();
    }
}



const main = () => {
    const hydroponic = new HydroponicManager();
}

main();
