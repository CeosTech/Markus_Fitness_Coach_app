import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

type CMSData = Record<string, string>;

const CMSContext = createContext<CMSData>({});

export const CMSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<CMSData>({});

  useEffect(() => {
    let cancelled = false;
    fetch('/api/cms')
      .then(res => res.json())
      .then(res => {
        if (!cancelled) {
          setData(res.entries || {});
        }
      })
      .catch(() => {
        if (!cancelled) setData({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <CMSContext.Provider value={data}>
      {children}
    </CMSContext.Provider>
  );
};

export const useCMS = () => {
  const data = useContext(CMSContext);
  const getValue = useCallback(
    (key: string, fallback: string | number | undefined = undefined) => {
      if (data && Object.prototype.hasOwnProperty.call(data, key)) {
        return data[key];
      }
      return fallback;
    },
    [data]
  );
  return { data, getValue };
};
