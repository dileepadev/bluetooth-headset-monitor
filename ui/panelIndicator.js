import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {DeviceMenuItem} from './deviceMenuItem.js';

const CUSTOM_ICON_NAME = 'audio-headset-symbolic.svg';
const FALLBACK_ICON_NAME = 'audio-headphones-symbolic';

export const HeadsetPanelIndicator = GObject.registerClass(
class HeadsetPanelIndicator extends PanelMenu.Button {
    _init(bluetoothManager, settings, extensionPath) {
        super._init(0.0, 'Bluetooth Headset Monitor');

        this._bluetoothManager = bluetoothManager;
        this._settings = settings;
        this._extensionPath = extensionPath;
        this._managerSignalId = 0;
        this._settingsSignalIds = [];

        this._icon = new St.Icon({
            style_class: 'system-status-icon',
        });
        this._setIndicatorIcon();
        this.add_child(this._icon);

        this._managerSignalId = this._bluetoothManager.connect('devices-changed', () => this.refresh());
        this._settingsSignalIds = [
            this._settings.connect('changed::show-device-address', () => this.refresh()),
            this._settings.connect('changed::show-rssi', () => this.refresh()),
        ];

        this.refresh();
    }

    destroy() {
        if (this._managerSignalId) {
            this._bluetoothManager?.disconnect(this._managerSignalId);
            this._managerSignalId = 0;
        }

        for (const signalId of this._settingsSignalIds.splice(0))
            this._settings?.disconnect(signalId);

        super.destroy();
    }

    _setIndicatorIcon() {
        const iconFile = Gio.File.new_for_path(`${this._extensionPath}/icons/${CUSTOM_ICON_NAME}`);

        if (iconFile.query_exists(null)) {
            this._icon.gicon = Gio.FileIcon.new(iconFile);
            this._icon.icon_name = null;
            return;
        }

        this._icon.gicon = null;
        this._icon.icon_name = FALLBACK_ICON_NAME;
    }

    refresh() {
        const devices = this._bluetoothManager.getConnectedHeadsets();
        this.visible = devices.length > 0;

        this.menu.removeAll();

        if (devices.length === 0)
            return;

        const header = new PopupMenu.PopupMenuItem('Bluetooth Headset Monitor', {
            reactive: false,
            can_focus: false,
        });
        header.label.style_class = 'bluetooth-headset-monitor-menu-header';
        this.menu.addMenuItem(header);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const showAddress = this._settings.get_boolean('show-device-address');
        const showRssi = this._settings.get_boolean('show-rssi');

        devices.forEach((device, index) => {
            this.menu.addMenuItem(new DeviceMenuItem(device, {
                showAddress,
                showRssi,
            }));

            if (index < devices.length - 1)
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        });

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const settingsItem = new PopupMenu.PopupMenuItem('Open Bluetooth Settings');
        settingsItem.connect('activate', () => {
            try {
                Gio.Subprocess.new(
                    ['gnome-control-center', 'bluetooth'],
                    Gio.SubprocessFlags.NONE
                );
            } catch (error) {
                logError(error, 'Bluetooth Headset Monitor: Failed to open Bluetooth settings');
            }
        });
        this.menu.addMenuItem(settingsItem);

        const refreshItem = new PopupMenu.PopupMenuItem('Refresh');
        refreshItem.connect('activate', () => this._bluetoothManager.refresh());
        this.menu.addMenuItem(refreshItem);
    }
});