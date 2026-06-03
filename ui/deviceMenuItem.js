import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

export const DeviceMenuItem = GObject.registerClass(
class DeviceMenuItem extends PopupMenu.PopupBaseMenuItem {
    _init(device, options = {}) {
        super._init({
            reactive: false,
            can_focus: false,
        });

        this._nameLabel = new St.Label({
            style_class: 'bluetooth-headset-monitor-device-name',
            x_expand: true,
            x_align: Clutter.ActorAlign.START,
        });

        this._detailLabel = new St.Label({
            style_class: 'bluetooth-headset-monitor-device-details',
            x_expand: true,
            x_align: Clutter.ActorAlign.START,
        });
        this._detailLabel.clutter_text.line_wrap = true;

        const content = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            style_class: 'bluetooth-headset-monitor-device',
        });
        content.add_child(this._nameLabel);
        content.add_child(this._detailLabel);
        this.add_child(content);

        this.updateDevice(device, options);
    }

    updateDevice(device, options = {}) {
        this._nameLabel.text = device.name;

        const lines = [
            `Battery: ${device.battery === null ? 'Unknown' : `${device.battery}%`}`,
            'Status: Connected',
            `Profile: ${device.profile}`,
        ];

        if (options.showAddress)
            lines.push(`Address: ${device.address}`);

        if (options.showRssi && device.rssi !== null)
            lines.push(`Signal: ${device.rssi} dBm`);

        this._detailLabel.text = lines.join('\n');
    }
});