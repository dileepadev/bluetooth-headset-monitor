import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class BluetoothHeadsetMonitorPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'Bluetooth Headset Monitor',
        });

        const generalGroup = new Adw.PreferencesGroup({
            title: 'Behavior',
            description: 'Control notifications and which device details appear in the panel menu.',
        });

        const notificationsRow = new Adw.SwitchRow({
            title: 'Show notifications',
            subtitle: 'Notify when headsets connect, disconnect, or reach the low battery threshold.',
        });
        settings.bind('show-notifications', notificationsRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        generalGroup.add(notificationsRow);

        const addressRow = new Adw.SwitchRow({
            title: 'Show device address',
            subtitle: 'Include the Bluetooth MAC address in each device entry.',
        });
        settings.bind('show-device-address', addressRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        generalGroup.add(addressRow);

        const rssiRow = new Adw.SwitchRow({
            title: 'Show signal strength',
            subtitle: 'Display RSSI in dBm when BlueZ reports it.',
        });
        settings.bind('show-rssi', rssiRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        generalGroup.add(rssiRow);

        const thresholdGroup = new Adw.PreferencesGroup({
            title: 'Low battery',
        });

        const thresholdRow = new Adw.ActionRow({
            title: 'Battery warning threshold',
            subtitle: 'Send a low battery notification when a connected device reaches this percentage.',
        });

        const thresholdAdjustment = new Gtk.Adjustment({
            lower: 1,
            upper: 100,
            step_increment: 1,
            page_increment: 5,
            value: settings.get_int('battery-warning-threshold'),
        });
        const thresholdSpin = new Gtk.SpinButton({
            adjustment: thresholdAdjustment,
            climb_rate: 1,
            digits: 0,
            valign: Gtk.Align.CENTER,
        });
        thresholdSpin.set_value(settings.get_int('battery-warning-threshold'));
        thresholdSpin.connect('value-changed', spin => {
            settings.set_int('battery-warning-threshold', spin.get_value_as_int());
        });
        settings.connect('changed::battery-warning-threshold', () => {
            thresholdSpin.set_value(settings.get_int('battery-warning-threshold'));
        });
        thresholdRow.add_suffix(thresholdSpin);
        thresholdRow.activatable_widget = thresholdSpin;
        thresholdGroup.add(thresholdRow);

        page.add(generalGroup);
        page.add(thresholdGroup);

        window.add(page);
        window.set_default_size(680, 520);
    }
}