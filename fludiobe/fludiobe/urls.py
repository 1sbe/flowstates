from django.contrib import admin
from django.urls import path, include
from django.views.generic.base import RedirectView
from .auth_views import (
    PublicTokenObtainPairView,
    PublicTokenRefreshView,
    CurrentUserView,
    RegisterView,
)

urlpatterns = [
    path('admin/', admin.site.urls),

    # registration endpoint
    path('api/auth/register/', RegisterView.as_view(), name='register'),

    path('api/auth/token/', PublicTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', PublicTokenRefreshView.as_view(), name='token_refresh'),

    # add current-user endpoint
    path('api/auth/user/', CurrentUserView.as_view(), name='current_user'),
    path('', RedirectView.as_view(url='/api/', permanent=False)),

    path('', include('simstates.urls')),
]