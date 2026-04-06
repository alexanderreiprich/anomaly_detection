from enum import Enum

class Label(str, Enum):
    ACCEPTABLE = "Acceptable"
    WARNING    = "Warning"
    CRITICAL   = "Critical"
