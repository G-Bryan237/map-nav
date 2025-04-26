import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, Alert, TextInput, ActivityIndicator, Keyboard, TouchableWithoutFeedback } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { FontAwesome, FontAwesome5, MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

const GOOGLE_MAPS_API_KEY = 'AIzaSyBCPP01-PaTSMCwbropwhO80VbNtaS9qnA';
const { width, height } = Dimensions.get('window');

// Add this helper function before the calculateHeading function
const decodePolyline = (encoded) => {
  const poly = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const len = encoded.length;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    poly.push({
      latitude: lat * 1e-5,
      longitude: lng * 1e-5
    });
  }

  return poly;
};

// Helper function to calculate bearing - moved to top
const calculateHeading = (start, end) => {
  const startLat = start.latitude * Math.PI / 180;
  const startLng = start.longitude * Math.PI / 180;
  const endLat = end.latitude * Math.PI / 180;
  const endLng = end.longitude * Math.PI / 180;
  
  const dLng = endLng - startLng;
  
  const y = Math.sin(dLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) -
            Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);
  
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
};

// SearchBar Component extracted for better organization
const SearchBar = ({ 
  isSearchVisible, 
  toggleSearch, 
  searchQuery, 
  setSearchQuery, 
  searchLocations,
  isSearching,
  searchResults,
  selectDestination
}) => {
  const searchTimeout = useRef(null);  // Add this line

  const handleQueryChange = (text) => {
    setSearchQuery(text);
    if (text.length > 2) {
      clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(() => {
        searchLocations(text);
      }, 300);
    }
  };

  return (
    <View style={[styles.searchContainer, 
      isSearchVisible ? styles.searchContainerActive : null]}>
      <View style={styles.searchInputContainer}>
        <TouchableOpacity 
          style={styles.searchIconContainer}
          onPress={toggleSearch}
        >
          {isSearchVisible ? (
            <Ionicons name="arrow-back" size={24} color="#4285F4" />
          ) : (
            <FontAwesome name="search" size={22} color="#4285F4" />
          )}
        </TouchableOpacity>
        
        {isSearchVisible && (
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a destination..."
            value={searchQuery}
            onChangeText={handleQueryChange}
            autoFocus
          />
        )}
        
        {isSearchVisible && searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              setSearchQuery('');
              setSearchResults([]);
            }}
          >
            <Ionicons name="close" size={20} color="#666" />
          </TouchableOpacity>
        )}
        
        {isSearchVisible && isSearching && (
          <ActivityIndicator style={styles.searchingIndicator} size="small" color="#4285F4" />
        )}
      </View>
      
      {/* Search Results */}
      {isSearchVisible && searchResults.length > 0 && (
        <View style={styles.searchResultsContainer}>
          {searchResults.map((result, index) => (
            <TouchableOpacity
              key={result.id}
              style={[styles.searchResultItem,
                index < searchResults.length - 1 && styles.searchResultItemBorder
              ]}
              onPress={() => selectDestination(result)}
            >
              <FontAwesome5 name="map-marker-alt" size={18} color="#4285F4" />
              <View style={styles.searchResultTextContainer}>
                <Text style={styles.searchResultName}>{result.name}</Text>
                <Text style={styles.searchResultAddress}>{result.address}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const RouteArrows = ({ coordinates }) => {
  if (!coordinates || coordinates.length < 2) return null;
  
  const arrowInterval = 5;
  
  return (
    <>
      {coordinates.map((coord, index) => {
        if (index % arrowInterval !== 0 || index === 0 || index === coordinates.length - 1) {
          return null;
        }
        
        const prevPoint = coordinates[index - 1];
        const heading = calculateHeading(prevPoint, coord);
        
        return (
          <Marker
            key={`arrow-${index}`}
            coordinate={coord}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={heading}
          >
            <View style={styles.directionArrow}>
              <FontAwesome5 
                name="chevron-up" 
                size={14} 
                color="#4285F4" 
                style={styles.arrowIcon} 
              />
            </View>
          </Marker>
        );
      })}
    </>
  );
};

const AccuracyIndicator = ({ accuracy }) => {
  let color = '#4CAF50'; // Good accuracy (green)
  let icon = 'gps-fixed';
  
  if (accuracy > 20) {
    color = '#FFC107'; // Medium accuracy (yellow)
    icon = 'gps-not-fixed';
  }
  if (accuracy > 50) {
    color = '#F44336'; // Poor accuracy (red)
    icon = 'gps-off';
  }
  
  return (
    <View style={[styles.accuracyIndicator, { borderColor: color }]}>
      <MaterialIcons name={icon} size={18} color={color} />
      <Text style={[styles.accuracyText, { color }]}>±{Math.round(accuracy)}m</Text>
    </View>
  );
};

const GoogleMapsCompass = ({ heading }) => {
  return (
    <View style={compassStyles.container}>
      <View style={compassStyles.outerRing}>
        <View style={[
          compassStyles.innerCompass,
          { transform: [{ rotate: `${heading}deg` }] }
        ]}>
          <View style={compassStyles.northIndicator} />
          <View style={compassStyles.compassFace}>
            <Text style={compassStyles.northText}>N</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default function App() {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [destination, setDestination] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [directions, setDirections] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [heading, setHeading] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [locationSubscription, setLocationSubscription] = useState(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [accuracyLevel, setAccuracyLevel] = useState('Standard');
  const [mapTheme, setMapTheme] = useState('standard'); // Add this
  const [routes, setRoutes] = useState([]); // Add this for multiple routes
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0); // Add this
  const mapRef = useRef(null);
  const lastCameraUpdate = useRef(null);  // Moved inside component
  const searchTimeout = useRef(null);
  
  // Request location permissions and get initial location
  useEffect(() => {
    (async () => {
      setIsLoadingLocation(true);
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        setIsLoadingLocation(false);
        return;
      }

      try {
        // Get initial location with high accuracy
        let location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
          maximumAge: 10000,
        });
        setLocation(location.coords);
        setIsLoadingLocation(false);
        setAccuracyLevel(`±${Math.round(location.coords.accuracy)}m`);
        
        // Start watching position updates with high accuracy
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 5,
            timeInterval: 1000,
          },
          (newLocation) => {
            setLocation(newLocation.coords);
            setAccuracyLevel(`±${Math.round(newLocation.coords.accuracy)}m`);
            if (isNavigating) {
              checkProgress(newLocation.coords);
            }
          }
        );
        
        setLocationSubscription(subscription);
        
        // Start watching heading/compass updates
        Location.watchHeadingAsync((headingData) => {
          setHeading(headingData.magHeading);
        });
      } catch (error) {
        console.error('Error getting location:', error);
        setErrorMsg('Failed to get your location. Please check your settings.');
        setIsLoadingLocation(false);
      }
    })();
    
    // Cleanup function
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  // Fetch route when both location and destination are available
  useEffect(() => {
    if (location && destination) {
      fetchRoute();
    }
  }, [location, destination]);

  // Read directions with speech when navigating and step changes
  useEffect(() => {
    if (isNavigating && directions.length > 0 && currentStep < directions.length) {
      const instruction = directions[currentStep].instruction;
      Speech.speak(instruction, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
      });
    }
  }, [currentStep, isNavigating]);

  // Play navigation start sound - using Speech instead of Audio
  const playStartSound = async () => {
    // Instead of playing a sound file, use Speech
    Speech.speak("Starting navigation", {
      language: 'en-US',
      pitch: 1.0,
      rate: 0.9,
    });
  };

  // Search for locations using Google Places API
  const searchLocations = async (query = null) => {
    const textToSearch = query || searchQuery;
    if (!textToSearch.trim()) return;
    
    setIsSearching(true);
    
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(textToSearch)}&types=establishment|geocode&key=${GOOGLE_MAPS_API_KEY}`
      );
      
      const json = await response.json();
      
      if (json.predictions && json.predictions.length > 0) {
        const detailPromises = json.predictions.slice(0, 5).map(async (prediction) => {
          const detailResponse = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=geometry,name,formatted_address&key=${GOOGLE_MAPS_API_KEY}`
          );
          const detailJson = await detailResponse.json();
          const place = detailJson.result;
          
          return {
            id: prediction.place_id,
            name: place.name || prediction.structured_formatting?.main_text || prediction.description,
            address: place.formatted_address || prediction.structured_formatting?.secondary_text || "",
            latitude: place.geometry?.location.lat,
            longitude: place.geometry?.location.lng
          };
        });
        
        const places = await Promise.all(detailPromises);
        setSearchResults(places);
      } else {
        setSearchResults([]);
        if (textToSearch.length > 3) {
          Alert.alert('No results found', 'Try a different search term');
        }
      }
    } catch (error) {
      console.error('Error searching locations:', error);
      Alert.alert('Error', 'Could not search for locations');
    } finally {
      setIsSearching(false);
    }
  };

  // Select a search result as destination
  const selectDestination = (result) => {
    setDestination({
      latitude: result.latitude,
      longitude: result.longitude,
      description: result.name
    });
    setSearchResults([]);
    setIsSearchVisible(false);
    Keyboard.dismiss();
    
    // Reset navigation state
    setIsNavigating(false);
    setCurrentStep(0);
  };

  // Fetch route using Google Directions API
  const fetchRoute = async () => {
    if (!location || !destination) return;
    
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${location.latitude},${location.longitude}&destination=${destination.latitude},${destination.longitude}&alternatives=true&key=${GOOGLE_MAPS_API_KEY}`
      );
      const json = await response.json();
      
      if (json.routes.length > 0) {
        const allRoutes = json.routes.map((route, index) => {
          const leg = route.legs[0];
          const points = decodePolyline(route.overview_polyline.points);
          
          return {
            coordinates: points,
            distance: leg.distance.text,
            duration: leg.duration.text,
            steps: leg.steps.map(step => ({
              instruction: step.html_instructions.replace(/<[^>]*>/g, ' '),
              distance: step.distance.text,
              duration: step.duration.text,
              startLocation: step.start_location,
              endLocation: step.end_location,
              maneuver: step.maneuver || ''
            }))
          };
        });

        setRoutes(allRoutes);
        setSelectedRouteIndex(0);
        setRouteCoordinates(allRoutes[0].coordinates);
        setDirections(allRoutes[0].steps);
        setDistance(allRoutes[0].distance);
        setDuration(allRoutes[0].duration);
      } else {
        Alert.alert('Route Not Found', 'Could not find a route to this destination');
      }
    } catch (error) {
      console.error('Error fetching directions:', error);
      Alert.alert('Error', 'Could not fetch directions. Please try again.');
    }
  };

  // Add route selection handler
  const selectRoute = (index) => {
    setSelectedRouteIndex(index);
    setRouteCoordinates(routes[index].coordinates);
    setDirections(routes[index].steps);
    setDistance(routes[index].distance);
    setDuration(routes[index].duration);
  };

  // Add this function before the return statement
  const toggleSearch = () => {
    setIsSearchVisible(!isSearchVisible);
    if (!isSearchVisible) {
      setSearchResults([]);
      setSearchQuery('');
    }
  };

  // Add missing zoom functions
  const zoomIn = () => {
    if (mapRef.current) {
      mapRef.current.getCamera().then((camera) => {
        camera.zoom += 1;
        mapRef.current.animateCamera(camera);
      });
    }
  };

  const zoomOut = () => {
    if (mapRef.current) {
      mapRef.current.getCamera().then((camera) => {
        camera.zoom -= 1;
        mapRef.current.animateCamera(camera, );
      });
    }
  };

  const toggleMapTheme = () => {
    setMapTheme(current => current === 'standard' ? 'satellite' : 'standard');
  };

  const recenterMap = () => {
    if (mapRef.current && location) {
      mapRef.current.animateCamera({
        center: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        zoom: 17,
        heading: 0,
        pitch: 0,
        duration: 1000,
      });
    }
  };

  const startNavigation = async () => {
    setIsNavigating(true);
    setCurrentStep(0);
    await playStartSound();
    
    // Center map on user's location and adjust zoom/bearing
    if (mapRef.current && location) {
      mapRef.current.animateCamera({
        center: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        zoom: 18,
        heading: heading,
        pitch: 60,
        duration: 1000,
      });
    }
  };

  const stopNavigation = () => {
    setIsNavigating(false);
    setCurrentStep(0);
    Speech.stop();
    
    // Reset map view
    if (mapRef.current) {
      mapRef.current.animateCamera({
        center: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        zoom: 16,
        heading: 0,
        pitch: 0,
        duration: 1000,
      });
    }
  };

  const checkProgress = (currentLocation) => {
    if (!directions || currentStep >= directions.length) return;
    
    const nextStep = directions[currentStep];
    const endLocation = nextStep.endLocation;
    
    // Calculate distance to next waypoint
    const distance = getDistance(
      currentLocation,
      { latitude: endLocation.lat, longitude: endLocation.lng }
    );
    
    // If within 30 meters of waypoint, move to next step
    if (distance < 30) {
      if (currentStep < directions.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        // Reached destination
        Alert.alert(
          'Arrived',
          'You have reached your destination!',
          [{ text: 'OK', onPress: stopNavigation }]
        );
      }
    }
  };

  const getDistance = (start, end) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = start.latitude * Math.PI / 180;
    const φ2 = end.latitude * Math.PI / 180;
    const Δφ = (end.latitude - start.latitude) * Math.PI / 180;
    const Δλ = (end.longitude - start.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
             Math.cos(φ1) * Math.cos(φ2) *
             Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  };

  const getManeuverIcon = (maneuver) => {
    switch (maneuver) {
      case 'turn-right': return 'arrow-right';
      case 'turn-left': return 'arrow-left';
      case 'turn-slight-right': return 'arrow-right';
      case 'turn-slight-left': return 'arrow-left';
      case 'turn-sharp-right': return 'arrow-right';
      case 'turn-sharp-left': return 'arrow-left';
      case 'uturn-right': return 'arrow-turn-up';
      case 'uturn-left': return 'arrow-turn-up';
      case 'roundabout-right': return 'circle-right';
      case 'roundabout-left': return 'circle-left';
      case 'straight': return 'arrow-up';
      case 'merge': return 'compress-arrows-alt';
      case 'fork': return 'code-branch';
      default: return 'arrow-up';
    }
  };

  // Modify the MapView component
  return (
    <TouchableWithoutFeedback onPress={() => {
      Keyboard.dismiss();
      if (isSearchVisible && searchResults.length === 0) {
        setIsSearchVisible(false);
      }
    }}>
      <SafeAreaView style={styles.container} edges={['top', 'right', 'left']}>
        <StatusBar style="auto" />
        
        {/* Content Container to organize layout */}
        <View style={styles.contentContainer}>
          {/* Top section for search bar */}
          <View style={styles.topSection}>
            <SearchBar 
              isSearchVisible={isSearchVisible}
              toggleSearch={toggleSearch}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchLocations={searchLocations}
              isSearching={isSearching}
              searchResults={searchResults}
              selectDestination={selectDestination}
            />
          </View>

          {/* Main Map View */}
          {isLoadingLocation ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4285F4" />
              <Text style={styles.loadingText}>Getting your location...</Text>
            </View>
          ) : location ? (
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              mapType={mapTheme}
              showsUserLocation
              userLocationUpdateInterval={1000}
              followsUserLocation={isNavigating}
              showsCompass={false}
              showsTraffic
              showsBuildings
              rotateEnabled={true}
              loadingEnabled={true}
              toolbarEnabled={false}
              showsMyLocationButton={false}
              showsPointsOfInterest={true}
              showsIndoors={true}
            >
              {/* Destination Marker */}
              {destination && (
                <Marker
                  coordinate={{
                    latitude: destination.latitude,
                    longitude: destination.longitude,
                  }}
                  title={destination.description}
                  pinColor="red"
                />
              )}
              
              {/* Route Polyline */}
              {routeCoordinates.length > 0 && (
                <Polyline
                  coordinates={routeCoordinates}
                  strokeWidth={4}
                  strokeColor="#4285F4"
                />
              )}
              {routeCoordinates.length > 0 && (
                <RouteArrows coordinates={routeCoordinates} />
              )}

              {/* Show alternative routes */}
              {routes.map((route, index) => (
                <Polyline
                  key={`route-${index}`}
                  coordinates={route.coordinates}
                  strokeWidth={index === selectedRouteIndex ? 4 : 2}
                  strokeColor={index === selectedRouteIndex ? '#4285F4' : '#B0B0B0'}
                  onPress={() => selectRoute(index)}
                />
              ))}
            </MapView>
          ) : (
            <View style={styles.loadingContainer}>
              <Text style={styles.errorText}>
                {errorMsg || "Unable to get your location. Please check your settings."}
              </Text>
            </View>
          )}

          {/* Navigation Information Panel */}
          {isNavigating && directions.length > 0 && currentStep < directions.length && (
            <View style={styles.directionsCard}>
              <View style={styles.directionsHeader}>
                <FontAwesome5 
                  name={getManeuverIcon(directions[currentStep].maneuver)} 
                  size={20} 
                  color="#4285F4" 
                />
                <Text style={styles.stepInstruction}>
                  {directions[currentStep].instruction}
                </Text>
              </View>
              <View style={styles.stepDetails}>
                <Text style={styles.stepDistance}>
                  {directions[currentStep].distance}
                </Text>
                <Text style={styles.stepTime}>
                  {directions[currentStep].duration}
                </Text>
              </View>
              {currentStep < directions.length - 1 && (
                <View style={styles.nextStepContainer}>
                  <Text style={styles.nextStepLabel}>Next:</Text>
                  <Text style={styles.nextStepText}>
                    {directions[currentStep + 1].instruction}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Trip Summary Card */}
          {!isNavigating && routeCoordinates.length > 0 && destination && (
            <View style={styles.summaryCard}>
              <Text style={styles.destinationText}>
                {destination.description}
              </Text>
              <View style={styles.summaryDetails}>
                <Text style={styles.distanceText}>Distance: {distance}</Text>
                <Text style={styles.durationText}>ETA: {duration}</Text>
              </View>
              <TouchableOpacity
                style={styles.startButton}
                onPress={startNavigation}
              >
                <Text style={styles.startButtonText}>Start Navigation</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Control Buttons */}
          <View style={styles.controlsContainer}>
            <TouchableOpacity style={styles.circleButton} onPress={zoomIn}>
              <FontAwesome name="plus" size={20} color="#4285F4" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.circleButton} onPress={zoomOut}>
              <FontAwesome name="minus" size={20} color="#4285F4" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.circleButton} onPress={toggleMapTheme}>
              <FontAwesome5 
                name={mapTheme === 'standard' ? 'satellite' : 'map'} 
                size={20} 
                color="#4285F4" 
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.circleButton} onPress={recenterMap}>
              <MaterialIcons name="my-location" size={26} color="#4285F4" />
            </TouchableOpacity>

            {/* Compass (only visible in non-navigation mode) */}
            {!isNavigating && (
              <TouchableOpacity style={[styles.circleButton, styles.compassButton]} activeOpacity={0.7}>
                <GoogleMapsCompass heading={heading} />
              </TouchableOpacity>
            )}

            {/* Search Button (Only when not searching) */}
            {!isSearchVisible && (
              <TouchableOpacity 
                style={styles.circleButton} 
                onPress={toggleSearch}
                activeOpacity={0.7}
              >
                <FontAwesome name="search" size={24} color="#4285F4" />
              </TouchableOpacity>
            )}

            {/* Stop Navigation Button (Only visible when navigating) */}
            {isNavigating && (
              <TouchableOpacity 
                style={styles.stopButtonContainer} 
                onPress={stopNavigation}
                activeOpacity={0.7}
              >
                <View style={styles.stopButton}>
                  <Text style={styles.stopButtonText}>End Navigation</Text>
                  <FontAwesome5 name="times-circle" size={18} color="white" style={styles.stopIcon} />
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Add route selection panel when not navigating */}
        {!isNavigating && routes.length > 1 && (
          <View style={styles.routeSelector}>
            {routes.map((route, index) => (
              <TouchableOpacity
                key={`route-option-${index}`}
                style={[
                  styles.routeOption,
                  index === selectedRouteIndex && styles.selectedRoute
                ]}
                onPress={() => selectRoute(index)}
              >
                <Text style={styles.routeOptionText}>
                  Route {index + 1}: {route.duration} ({route.distance})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    flex: 1,
    position: 'relative',
  },
  topSection: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    padding: 10,
  },
  map: {
    flex: 1,
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
  },
  errorText: {
    fontSize: 18,
    color: 'red',
    textAlign: 'center',
    marginTop: 100,
  },
  searchContainer: {
    width: '100%',
    backgroundColor: 'transparent',
    zIndex: 100,
  },
  searchContainerActive: {
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  searchIconContainer: {
    padding: 5,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  clearButton: {
    padding: 8,
  },
  searchButton: {
    backgroundColor: '#4285F4',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  searchResultsContainer: {
    backgroundColor: 'white',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    maxHeight: height * 0.5,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  searchResultItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchResultTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchResultAddress: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  accuracyIndicator: {
    display: 'none', // This will hide the component
  },
  accuracyText: {
    display: 'none', // This will hide the component
  },
  directionsCard: {
    position: 'absolute',
    top: 80,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 90,
  },
  directionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepInstruction: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
  },
  stepDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  stepDistance: {
    fontSize: 14,
    color: '#444',
  },
  stepTime: {
    fontSize: 14,
    color: '#444',
  },
  nextStepContainer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextStepLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginRight: 8,
  },
  nextStepText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  summaryCard: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  destinationText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  summaryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  distanceText: {
    fontSize: 16,
    color: '#444',
  },
  durationText: {
    fontSize: 16,
    color: '#444',
  },
  startButton: {
    backgroundColor: '#4285F4',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  startButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  controlsContainer: {
    position: 'absolute',
    right: 16,
    bottom: 200,
    alignItems: 'center',
  },
  circleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  recenterButton: {
    borderWidth: 2,
    borderColor: '#4285F4',
  },
  compassButton: {
    borderWidth: 1,
    borderColor: '#DDDDDD',
  },
  stopButtonContainer: {
    marginVertical: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    borderRadius: 24,
    overflow: 'hidden',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC3545',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
  },
  stopButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  stopIcon: {
    marginLeft: 8,
  },
  searchingIndicator: {
    marginHorizontal: 10,
  },
  directionArrow: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  arrowIcon: {
    marginTop: -2,
  },
  routeSelector: {
    position: 'absolute',
    bottom: 160,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  routeOption: {
    padding: 12,
    borderRadius: 4,
    marginVertical: 4,
    backgroundColor: '#f0f0f0',
  },
  selectedRoute: {
    backgroundColor: '#e3f2fd',
    borderColor: '#4285F4',
    borderWidth: 1,
  },
  routeOptionText: {
    fontSize: 14,
    color: '#333',
  },
});

const compassStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    position: 'relative',
  },
  innerCompass: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4285F4',
  },
  northIndicator: {
    position: 'absolute',
    width: 2,
    height: 10,
    backgroundColor: '#CCCCCC',
    top: -5,
  },
  compassFace: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  northText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4285F4',
  },
});