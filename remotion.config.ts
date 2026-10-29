import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("angle");
// Scenes are SVG/DOM heavy; this keeps rasterisation sharp at 1080x1920.
Config.setScale(1);
