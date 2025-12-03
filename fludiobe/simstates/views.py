from rest_framework import viewsets, permissions
from .models import SimState
from .serializers import SimStateSerializer

class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Object-level permission to only allow owners of an object or superusers to edit/view it.
    """

    def has_object_permission(self, request, view, obj):
        # Superusers can always access
        if request.user and request.user.is_superuser:
            return True
        # Otherwise only the owner can access
        return obj.owner == request.user

class SimStateViewSet(viewsets.ModelViewSet):
    """
    ModelViewSet for SimState.

    - Regular authenticated users see only their own simstates (get_queryset).
    - Superusers see all simstates.
    - Object permissions allow owners and superusers to retrieve/update/delete individual objects.
    """
    serializer_class = SimStateSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]

    def get_queryset(self):
        user = self.request.user
        if user and user.is_authenticated and user.is_superuser:
            # Admins/superusers see everything
            return SimState.objects.all()
        # Regular users only see their own states
        return SimState.objects.filter(owner=user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)