import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export const MapControls = ({
  location,
  mapRef,
  compass,
  groundView,
  setGroundView,
  isDarkMode,
  toggleTheme,
  isNorthUp,
  setIsNorthUp,
  alternativeRoutes = [], // Add default value
  selectedRouteIndex,
  selectRoute,
}) => {
  const toggleGroundView = () => {
    setGroundView(!groundView);
    if (location?.coords && mapRef.current) { // Add null check
      mapRef.current.animateCamera({
        center: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        heading: !groundView ? (location.coords.heading || compass) : 0,
        pitch: !groundView ? 75 : 0,
        zoom: !groundView ? 20 : 17,
      }, { duration: 800 });

      if (!groundView) {
        setTimeout(() => {
          mapRef.current.animateCamera({
            center: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            },
            heading: location.coords.heading || compass,
            pitch: 85,
            zoom: 22,
            altitude: 8,
          }, { duration: 700 });
        }, 800);
      }
    }
  };

  // Only render controls if location is available
  if (!location?.coords) return null;

  return (
    <>
      {/* Ground View Toggle */}
      <TouchableOpacity 
        className="absolute bottom-60 left-4 bg-white rounded-full py-3 px-5 flex-row items-center"
        onPress={toggleGroundView}
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 2
        }}
      >
        <MaterialIcons name={groundView ? "3d-rotation" : "streetview"} size={20} color="#5F6368" />
        <Text className="text-[#212121] ml-2 font-medium">{groundView ? "Map View" : "Street View"}</Text>
      </TouchableOpacity>

      {/* Right Controls */}
      <View className="absolute right-4 top-32 space-y-4">
        {/* Compass */}
        <TouchableOpacity
          className="bg-white w-12 h-12 rounded-full items-center justify-center"
          onPress={() => {
            setIsNorthUp(!isNorthUp);
            if (mapRef.current) {
              mapRef.current.animateCamera({
                heading: isNorthUp ? (location?.coords?.heading || compass) : 0,
                duration: 300
              });
            }
          }}
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2
          }}
        >
          {isNorthUp ? (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: '#5F6368' }}>N</Text>
              <View style={{ position: 'absolute', bottom: -10, width: 2, height: 4, backgroundColor: 'red' }} />
            </View>
          ) : (
            <View style={{ transform: [{ rotate: `${-compass}deg` }], alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="navigation" size={22} color="#5F6368" />
              <View style={{ position: 'absolute', top: -2, width: 2, height: 4, backgroundColor: 'red' }} />
              <Text style={{ position: 'absolute', top: -15, fontSize: 8, color: "#5F6368" }}>N</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Theme Toggle */}
        <TouchableOpacity 
          className="bg-white w-12 h-12 rounded-full items-center justify-center"
          onPress={toggleTheme}
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2
          }}
        >
          <MaterialIcons name={isDarkMode ? "light-mode" : "dark-mode"} size={24} color="#5F6368" />
        </TouchableOpacity>
      </View>

      {/* Alternative Routes */}
      {alternativeRoutes.length > 0 && (
        <View className="absolute left-4 right-4 bottom-24 mb-20">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {alternativeRoutes.map((route, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => selectRoute(index)}
                style={{
                  marginRight: 12,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 24,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: selectedRouteIndex === index ? '#4285F4' : 'white',
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.22,
                  shadowRadius: 2.22,
                  elevation: 3
                }}
              >
                <MaterialIcons 
                  name={index === 0 ? 'directions-car' : route.isEco ? 'eco' : 'schedule'} 
                  size={20} 
                  color={selectedRouteIndex === index ? 'white' : '#5F6368'} 
                />
                <Text style={{ 
                  marginLeft: 6,
                  color: selectedRouteIndex === index ? 'white' : '#212121',
                  fontWeight: '500'
                }}>
                  {route.duration}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </>
  );
};

export default MapControls;
