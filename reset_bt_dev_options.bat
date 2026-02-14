@echo off
adb wait-for-device
adb shell settings delete global bluetooth_disable_a2dp_hw_offload
adb shell settings delete global bluetooth_le_audio_hw_offload_disabled
adb shell settings delete global bluetooth_avrcp_version
adb shell settings delete global bluetooth_a2dp_supports_optional_codecs
adb reboot
