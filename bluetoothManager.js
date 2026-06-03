import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

const BLUEZ_NAME = 'org.bluez';
const BLUEZ_ROOT = '/';
const DEVICE_IFACE = 'org.bluez.Device1';
const BATTERY_IFACE = 'org.bluez.Battery1';

const AUDIO_UUIDS = new Set([
    '00001108-0000-1000-8000-00805f9b34fb',
    '0000110b-0000-1000-8000-00805f9b34fb',
    '0000110e-0000-1000-8000-00805f9b34fb',
    '0000111e-0000-1000-8000-00805f9b34fb',
]);

const PROFILE_LABELS = new Map([
    ['00001108-0000-1000-8000-00805f9b34fb', 'HSP'],
    ['0000110b-0000-1000-8000-00805f9b34fb', 'A2DP'],
    ['0000110e-0000-1000-8000-00805f9b34fb', 'A2DP'],
    ['0000111e-0000-1000-8000-00805f9b34fb', 'HFP'],
]);

function _deepUnpack(property, fallback = null) {
    if (!property)
        return fallback;

    return property.deepUnpack();
}

function _normalizeUuid(uuid) {
    return uuid.toLowerCase();
}

export const BluetoothManager = GObject.registerClass({
    Signals: {
        'devices-changed': {},
    },
}, class BluetoothManager extends GObject.Object {
    _init() {
        super._init();

        this._objectManager = null;
        this._managerSignals = [];
        this._proxySignals = new Map();
        this._devices = new Map();

        this.refresh();
    }

    destroy() {
        for (const signalId of this._managerSignals)
            this._objectManager?.disconnect(signalId);

        this._managerSignals = [];

        for (const [proxy, signalId] of this._proxySignals)
            proxy.disconnect(signalId);

        this._proxySignals.clear();
        this._devices.clear();
        this._objectManager = null;
    }

    refresh() {
        this._ensureObjectManager();
        this._rebuildDevices();
        this.emit('devices-changed');
    }

    getConnectedHeadsets() {
        return [...this._devices.values()]
            .sort((left, right) => left.name.localeCompare(right.name));
    }

    getDeviceBattery(devicePath) {
        return this._devices.get(devicePath)?.battery ?? null;
    }

    getDeviceName(devicePath) {
        return this._devices.get(devicePath)?.name ?? null;
    }

    _ensureObjectManager() {
        if (this._objectManager)
            return;

        try {
            this._objectManager = Gio.DBusObjectManagerClient.new_for_bus_sync(
                Gio.BusType.SYSTEM,
                Gio.DBusObjectManagerClientFlags.NONE,
                BLUEZ_NAME,
                BLUEZ_ROOT,
                null,
                null
            );
        } catch (error) {
            logError(error, 'Bluetooth Headset Monitor: Failed to create BlueZ object manager');
            return;
        }

        this._managerSignals = [
            this._objectManager.connect('object-added', () => this._syncState()),
            this._objectManager.connect('object-removed', () => this._syncState()),
            this._objectManager.connect('interface-added', (_, object, iface) => {
                this._watchProxy(iface);
                this._syncState();
            }),
            this._objectManager.connect('interface-removed', (_, object, iface) => {
                this._unwatchProxy(iface);
                this._syncState();
            }),
        ];

        for (const object of this._objectManager.get_objects()) {
            for (const ifaceName of [DEVICE_IFACE, BATTERY_IFACE]) {
                const proxy = object.get_interface(ifaceName);
                if (proxy)
                    this._watchProxy(proxy);
            }
        }
    }

    _watchProxy(proxy) {
        if (this._proxySignals.has(proxy))
            return;

        const signalId = proxy.connect('g-properties-changed', () => this._syncState());
        this._proxySignals.set(proxy, signalId);
    }

    _unwatchProxy(proxy) {
        const signalId = this._proxySignals.get(proxy);
        if (!signalId)
            return;

        proxy.disconnect(signalId);
        this._proxySignals.delete(proxy);
    }

    _syncState() {
        this._rebuildDevices();
        this.emit('devices-changed');
    }

    _rebuildDevices() {
        this._devices.clear();

        if (!this._objectManager)
            return;

        for (const object of this._objectManager.get_objects()) {
            const deviceProxy = object.get_interface(DEVICE_IFACE);
            if (!deviceProxy)
                continue;

            const device = this._readDevice(object, deviceProxy);
            if (!device)
                continue;

            this._devices.set(device.path, device);
        }
    }

    _readDevice(object, deviceProxy) {
        const connected = Boolean(_deepUnpack(deviceProxy.get_cached_property('Connected'), false));
        if (!connected)
            return null;

        const uuids = (_deepUnpack(deviceProxy.get_cached_property('UUIDs'), []) || [])
            .map(_normalizeUuid);

        if (!uuids.some(uuid => AUDIO_UUIDS.has(uuid)))
            return null;

        const batteryProxy = object.get_interface(BATTERY_IFACE);
        const percentage = _deepUnpack(batteryProxy?.get_cached_property('Percentage'));
        const rssi = _deepUnpack(deviceProxy.get_cached_property('RSSI'));
        const alias = _deepUnpack(deviceProxy.get_cached_property('Alias'), 'Unknown Device');
        const address = _deepUnpack(deviceProxy.get_cached_property('Address'), 'Unknown');

        return {
            path: object.get_object_path(),
            name: alias,
            address,
            connected,
            battery: Number.isInteger(percentage) ? percentage : null,
            profile: this._getProfileLabel(uuids),
            rssi: typeof rssi === 'number' ? rssi : null,
            uuids,
            lastSeen: GLib.DateTime.new_now_local().format('%FT%T%z'),
        };
    }

    _getProfileLabel(uuids) {
        for (const uuid of uuids) {
            const label = PROFILE_LABELS.get(uuid);
            if (label)
                return label;
        }

        return 'Audio';
    }
});