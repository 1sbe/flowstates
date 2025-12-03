from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

# Make token endpoints explicitly public so unauthenticated clients can obtain tokens
class PublicTokenObtainPairView(TokenObtainPairView):
    permission_classes = (AllowAny,)


class PublicTokenRefreshView(TokenRefreshView):
    permission_classes = (AllowAny,)