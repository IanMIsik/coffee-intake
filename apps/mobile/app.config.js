// Extends app.json. Test builds may talk to a plain http:// server on your network;
// production builds (APP_VARIANT=production) may only use https://.
module.exports = ({ config }) => {
  const isProduction = process.env.APP_VARIANT === "production";
  return {
    ...config,
    plugins: (config.plugins ?? []).map((plugin) =>
      Array.isArray(plugin) && plugin[0] === "expo-build-properties"
        ? ["expo-build-properties", { android: { usesCleartextTraffic: !isProduction } }]
        : plugin
    ),
  };
};
