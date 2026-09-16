import React, { useState } from "react";
import { MapPin, Locate, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function LocationPicker({ address, setAddress, latitude, setLatitude, longitude, setLongitude }) {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  const useGPS = () => {
    setError("");
    setLocating(true);
    if (!navigator.geolocation) {
      setError("المتصفح لا يدعم تحديد الموقع");
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setLocating(false);
      },
      (err) => {
        setError("تعذر الحصول على الموقع: " + err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const mapsLink = latitude && longitude
    ? `https://www.google.com/maps?q=${latitude},${longitude}`
    : null;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="address">عنوان التوصيل</Label>
        <Input
          id="address"
          placeholder="الحي، الشارع، أقرب معلم"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="h-12"
          required
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={useGPS} disabled={locating} className="h-12 flex-1">
          {locating ? (
            <>
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              جاري التحديد...
            </>
          ) : (
            <>
              <Locate className="w-4 h-4 ml-2" />
              تحديد موقعي الحالي
            </>
          )}
        </Button>
        {mapsLink && (
          <a
            href={mapsLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center h-12 px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted"
          >
            <MapPin className="w-4 h-4 ml-1" />
            عرض
          </a>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {latitude && longitude && (
        <p className="text-xs text-muted-foreground">
          الإحداثيات: {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </p>
      )}
    </div>
  );
}