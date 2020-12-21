# Disable warnings
options(warn=-1)

# Clear plots
if(!is.null(dev.list())) dev.off()
# Clear console
cat("\014") 
# Clean workspace
rm(list=ls())

library(lidR)
library(parallel)
library(concaveman)
library(future)
library(rlas)
library(sp)
library(rgdal)
library(raster)
library(dplyr)
library(sf)
library(ForestTools)
#library(EBImage)	# needed to remove this b/c it interferes with watershed algorithm in lidR
library(stringr)
library(rjson)

validInput <- function( param, default ){
  #print(length(unlist(param)) > 0)
  if(length(unlist(param)) > 0)  # true if valid integer
    return(param)
  else
    return(default)
}

arg <- commandArgs(TRUE)
home <- arg[1]
lasName <- arg[2]
jsonFile <- fromJSON(file = arg[3])
outputDir <- paste(home, 'outputs', "/", sep="")

home
outputDir

res <- as.numeric(validInput(jsonFile["res"], 1)) #resolution of DTM and CHM in feet
ws <- as.numeric(validInput(jsonFile["ws"], 10)) #size of moving window in feet
z <- as.numeric(validInput(jsonFile["z"], 10)) #minimum tree height in feet
algorithm <- validInput(jsonFile["algorithm"], "NULL")
if(algorithm == "NULL" || (algorithm != "silva2016" && algorithm != "dalponte2016" && algorithm != "wing2015" && algorithm != "watershed" && algorithm != "mcws"))
  stop()

res
ws
z
algorithm

# dalponte2016 params
th_tree <- as.numeric(validInput(jsonFile["th_tree"], 2))
th_seed <- as.numeric(validInput(jsonFile["th_seed"], 0.45))
th_cr <- as.numeric(validInput(jsonFile["th_cr"], 0.55))
max_cr <- as.numeric(validInput(jsonFile["max_cr"], 10))

th_tree
th_seed
th_cr
max_cr

# wing2015 params
#neigh_radii <- validInput(jsonFile["neigh_radii"], 2)
low_int_thrsh <- as.numeric(validInput(jsonFile["low_int_thrsh"], 50))
uppr_int_thrsh <- as.numeric(validInput(jsonFile["uppr_int_thrsh"], 170))
pt_den_req <- as.numeric(validInput(jsonFile["pt_den_req"], 3))

#neigh_radii
low_int_thrsh
uppr_int_thrsh
pt_den_req

# watershed params
th_tree <- as.numeric(validInput(jsonFile["th_tree"], 2))
tol <- as.numeric(validInput(jsonFile["tol"], 1))
ext <- as.numeric(validInput(jsonFile["ext"], 1))

th_tree
tol
ext

#filename for single las tile
lasfile <- paste(home, lasName, sep = "")
print(lasfile)
las <- readLAS(lasfile)

#create output directory 
chmfile <- paste(outputDir,paste(tools::file_path_sans_ext(basename(lasfile))),'_CHM.tif',sep="")
crownfile <- paste(outputDir,paste(tools::file_path_sans_ext(basename(lasfile))),'_crowns',sep="")

p <- util_makeZhangParam()#Take parameters from Zhang paper
cores <- detectCores() #How many processor cores are available
plan(multisession, workers = 2L)#set up parallel processing (2L = 2 Clusters)
#Choose one of the following 2 options:
#set_lidr_threads(cores/2)#1. for dedicated processing, use all cores
set_lidr_threads(((cores-2) /2 ))#2. for background processing, reserve 2 cores

ptm <- proc.time() #Start the clock

#Ground classification
print("Starting Ground Point Detection...")
#Katie method
las <- lasground(las, pmf(p$ws, p$th), last_returns = FALSE) #Cloth simulation filter
print("Ground Point Detection Complete! Starting DTM Creation...")
res=0.5 #resolution of DTM and CHM in feet
dtm = grid_terrain(las, res = res, algorithm = knnidw())
writeRaster(dtm, filename=file.path(outputDir, "DTM"), format='GTiff', overwrite=TRUE)

#Normalize
print("DTM Creation Complete! Starting Normalization...")
las = lasnormalize(las, dtm)
las = lasfilter(las, Z >= 0)
#ground <- lasfilter(las_normal, Classification == 2L)
#plot(ground)
#filter_noise = function(las_normal, sensitivity)
# #{
#   p95 <- grid_metrics(las, ~quantile(Z, probs = 0.95), 10)
#   las <- merge_spatial(las, p95, "p95")
#   las <- filter_poi(las, Z < p95*sensitivity)
#   las$p95 <- NULL
#   return(las)
# }
# las <- filter_noise(las, sensitivity = 1.2)

#Metrics
myMetrics = function(X, Y, Z)
{
  metrics = list(
    zmax = max(Z),
    number_of_points = length(Z),
    point_density_ft = length(Z)/((max(X) - min(X)) * (max(Y) - min(Y))),
    point_density_mt = (length(Z)/((max(X) - min(X)) * (max(Y) - min(Y))))/3.2808399,
    area_sq_ft =  (max(X) - min(X)) * (max(Y) - min(Y)),
    area_sq_mt =  (max(X) - min(X)) * (max(Y) - min(Y))/3.2808399,
    area_sq_ac =  (max(X) - min(X)) * (max(Y) - min(Y))/43560,
    area_sq_ha =  (max(X) - min(X)) * (max(Y) - min(Y))/107639.1041671)
  return(metrics)
}

std_metrics=cloud_metrics(las, .stdmetrics)
print(std_metrics)
metrics = cloud_metrics(las, ~myMetrics(X,Y,Z))
print(metrics)

z = runif(10000, 0, 10)
VCI(z, by = 1, zmax = 20)

quantile(las@data$Z,probs = c(0.25,0.50,0.75,0.9,0.95))

#Create CHM
print('Creating CHM...')
chm <- grid_canopy(las, res = 0.5, pitfree(c(0,2,5,10,15), c(0, 2), subcircle = 0.5))
print('Smoothing CHM...')
ker <- matrix(1,3,3)
chm <- raster::focal(chm, w = ker, fun = mean, na.rm = TRUE)
writeRaster(chm, chmfile, format='GTiff', overwrite=TRUE)

#Detect tree tops
print("Detecting Local Maxima...")
ttops <- tree_detection(las, lmf(16, 4.5, shape = c("circular")))
sp_summarise(ttops)
#crs(ttops) <- "+proj=utm +zone=11 +ellps=GRS80 +datum=NAD83" 
writeOGR(ttops, outputDir, layer="_Max_Ht", driver="ESRI Shapefile", overwrite_layer=TRUE)
print("Local Maxima Detection Complete! Segmenting Tree Crowns...")


print("Local Maxima Detection Complete! Segmenting Tree Crowns...")
print(algorithm)
if(algorithm == "mcws"){
  crowns = mcws(ttops, chm, minHeight = 4.5, format = "polygons", OSGeoPath = NULL, verbose = TRUE)
}
if(algorithm == "silva2016"){
  crowns = lastrees(las_normal, silva2016(chm, ttops)) ##### INSERT USFS R6 CHM ##### 
}
if(algorithm == "dalponte2016"){
  crowns = lastrees(las_normal, dalponte2016(chm,ttops,th_tree = th_tree,th_seed = th_seed,th_cr = th_cr,max_cr = max_cr,ID = "treeID"))
}
if(algorithm == "wing2015"){
  bbpr_thresholds <- matrix(c(0.80, 0.80, 0.70,
                        0.85, 0.85, 0.60,
                        0.80, 0.80, 0.60,
                        0.90, 0.90, 0.55),
                        nrow =3, ncol = 4)

  crowns = lassnags(las_normal, wing2015(neigh_radii = c(1.5, 1, 2),low_int_thrsh = low_int_thrsh,uppr_int_thrsh = uppr_int_thrsh,pt_den_req = pt_den_req,BBPRthrsh_mat = bbpr_thresholds))
}
if(algorithm == "watershed"){
  crowns = lastrees(las_normal, watershed(chm, th_tree = th_tree, tol = tol, ext = ext))
}

# watershed - https://rdrr.io/cran/lidR/man/watershed.html
# wing2015 - https://rdrr.io/cran/lidR/man/wing2015.html
# dalponte2016 - https://rdrr.io/cran/lidR/man/dalponte2016.html

writeOGR(crowns, crownfile, layer="_Crown_Polys", driver="ESRI Shapefile", overwrite_layer=TRUE)

proc.time() - ptm   #STOP THE CLOCK