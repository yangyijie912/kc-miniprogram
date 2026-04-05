export const jsonToUrlParam = (json: Record<string, any>) => {
  return Object.keys(json)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(json[key])}`)
    .join('&');
};
