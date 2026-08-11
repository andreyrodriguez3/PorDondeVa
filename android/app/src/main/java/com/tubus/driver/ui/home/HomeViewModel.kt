package com.tubus.driver.ui.home

import android.app.Application
import android.content.Intent
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tubus.driver.data.remote.BusSummaryDto
import com.tubus.driver.data.remote.RouteAssignmentDto
import com.tubus.driver.data.remote.TripDto
import com.tubus.driver.data.repo.AuthRepository
import com.tubus.driver.data.repo.LocationRepository
import com.tubus.driver.data.repo.TripRepository
import com.tubus.driver.location.TrackingService
import com.tubus.driver.sync.SyncScheduler
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class HomeUiState(
    val loading: Boolean = true,
    val buses: List<BusSummaryDto> = emptyList(),
    val routes: List<RouteAssignmentDto> = emptyList(),
    val selectedBusId: String? = null,
    val selectedRoute: RouteAssignmentDto? = null,
    val activeTrip: TripDto? = null,
    val error: String? = null,
)

@HiltViewModel
class HomeViewModel @Inject constructor(
    application: Application,
    private val tripRepository: TripRepository,
    private val authRepository: AuthRepository,
    private val locationRepository: LocationRepository,
    private val syncScheduler: SyncScheduler,
) : AndroidViewModel(application) {

    private val _state = MutableStateFlow(HomeUiState())
    val state: StateFlow<HomeUiState> = _state.asStateFlow()

    val queueDepth: StateFlow<Int> = locationRepository.queueDepthFlow()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            try {
                val assignment = tripRepository.getAssignment()
                val activeTrip = tripRepository.getActiveTrip()
                _state.update {
                    it.copy(
                        loading = false,
                        buses = assignment.buses,
                        routes = assignment.routes,
                        selectedBusId = it.selectedBusId ?: assignment.defaultBusId,
                        activeTrip = activeTrip,
                    )
                }
                if (activeTrip != null) resumeTracking(activeTrip.id)
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = "No se pudo cargar la asignación.") }
            }
        }
    }

    fun selectBus(busId: String) = _state.update { it.copy(selectedBusId = busId) }
    fun selectRoute(route: RouteAssignmentDto) = _state.update { it.copy(selectedRoute = route) }

    fun startTrip() {
        val route = _state.value.selectedRoute ?: return
        viewModelScope.launch {
            try {
                val trip = tripRepository.startTrip(route.variantId, _state.value.selectedBusId)
                _state.update { it.copy(activeTrip = trip) }
                resumeTracking(trip.id)
            } catch (e: Exception) {
                _state.update { it.copy(error = "No se pudo iniciar el viaje.") }
            }
        }
    }

    fun endTrip() {
        val trip = _state.value.activeTrip ?: return
        viewModelScope.launch {
            try {
                tripRepository.endTrip(trip.id)
                getApplication<Application>().stopService(
                    Intent(getApplication(), TrackingService::class.java),
                )
                syncScheduler.cancel()
                _state.update { it.copy(activeTrip = null) }
            } catch (e: Exception) {
                _state.update { it.copy(error = "No se pudo finalizar el viaje.") }
            }
        }
    }

    fun logout() {
        authRepository.logout()
    }

    private fun resumeTracking(tripId: String) {
        val context = getApplication<Application>()
        context.startForegroundService(TrackingService.startIntent(context, tripId))
    }
}
