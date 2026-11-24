import MapView, { Marker, type LatLng } from 'react-native-maps';

type BostonMapProps = {
  guess: LatLng | null;
  answer: LatLng | null;
  onGuess: (coordinate: LatLng) => void;
};

export default function BostonMap({
  guess,
  answer,
  onGuess,
}: BostonMapProps) {
  return (
    <MapView
      style={{ width: '100%', height: 360 }}
      initialRegion={{
        latitude: 42.345,
        longitude: -71.085,
        latitudeDelta: 0.14,
        longitudeDelta: 0.14,
      }}
      mapType="standard"
      showsPointsOfInterests={false}
      showsBuildings={false}
      showsTraffic={false}
      showsUserLocation={false}
      showsCompass
      rotateEnabled={false}
      pitchEnabled={false}
      onPress={(event) => {
        if (!answer) {
          onGuess(event.nativeEvent.coordinate);
        }
      }}
    >
      {guess && (
        <Marker
          coordinate={guess}
          pinColor="#2357C7"
          title="Your guess"
        />
      )}

      {answer && (
        <Marker
          coordinate={answer}
          pinColor="#228544"
          title="Correct location"
        />
      )}
    </MapView>
  );
}